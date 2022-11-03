export default class ProcessBetQueue {
    processTimeOut = 50;

    constructor({
        definition,
        gameData,
        placeBetPublisher,
        betsRepository,
        betLogsRepository,
        logService,
        baseMetrics,
        baseProcessBetQueue,
        rebetProcessor,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.placeBetPublisher = placeBetPublisher;
        this.betsRepository = betsRepository;
        this.betLogsRepository = betLogsRepository;
        this.baseMetrics = baseMetrics;
        this.logService = logService;
        this.baseProcessBetQueue = baseProcessBetQueue;
        this.rebetProcessor = rebetProcessor;
    }

    start() {
        const keepDequeuingBets = () => {
            this.dequeueBets();
            setTimeout(keepDequeuingBets, this.processTimeOut);
        };

        setTimeout(keepDequeuingBets, this.processTimeOut);
    }

    dequeueBets() {
        if (this.gameData.ingame) {
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;
                    if (payload.rebet) {
                        this.proceedBet(player, payload)
                            .then(() => (playerInGame.betProcessing = false))
                            .catch(this.logService.logError);
                    } else {
                        this.baseProcessBetQueue
                            .proceedBet(player, payload)
                            .then(() => (playerInGame.betProcessing = false))
                            .catch(this.logService.logError);
                    }
                }
            });
        }
    }

    // NO CHANGE so we could remove this
    async proceedBet(player, payload) {
        const betInfo = this.baseProcessBetQueue.formatApiBetInfo(payload);

        if (!(await this.baseProcessBetQueue.validateBetRequest(player, payload))) {
            return;
        }

        const apiResult = await this.baseProcessBetQueue.placeBet({ id: player.UID, session: player.session }, betInfo);
        const { response } = apiResult;

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, response, betInfo.gameRoundId, payload);
        } else {
            this.handleFailedBet(player, response, payload);

            if (
                (player.profile.minBet !== response.apiError?.minBet || player.profile.maxBet !== response.apiError?.maxBet) &&
                response.apiError?.minBet > 0 &&
                response.apiError?.maxBet > 0
            ) {
                await this.baseProcessBetQueue.updateUserStakeLevel(player, response.apiError.minBet, response.apiError.maxBet);
            }
        }

        const totalProcessedTime = (new Date() - payload.receivedTime) / 1000;
        this.baseMetrics.collectBetProcessedTime(totalProcessedTime);
    }

    // NO CHANGE so we could remove this
    handleFailedBet(player, notice, bet) {
        this.decreaseBetTracks(player.profile.name, bet);

        if (notice.apiError) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, kickedOut: notice.kickedOut });
        } else {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, notice });
        }
    }

    // TODO bring this to game service
    decreaseBetTracks(playerName, bet) {
        const { oldBet } = bet;
        Object.entries(oldBet).forEach(([betChoice, amount]) =>
            this.baseProcessBetQueue.decreaseBetTracks(playerName, { betChoice, amount })
        );
    }

    // NO CHANGE so we could remove this
    async handleSuccessBet(player, balance, roundId, bet) {
        const rate = this.baseProcessBetQueue.calculateCurrencyRate(player.session);

        if (this.betLogsRepository) {
            await this.insertBetLog(player, roundId, bet, rate);
        }

        await this.upsertBet(player, roundId, bet, rate);

        if (this.baseProcessBetQueue.isCountOnTotalBets(player)) {
            this.adjustTotalBets(player, bet, rate);
        }

        this.adjustOwnBets(player.profile.name, bet);

        this.notifyPlacingBetResult(player, balance, bet, rate);

        if (!bet.freeBet && (player.profile.minBet !== balance.minBet || player.profile.maxBet !== balance.maxBet)) {
            await this.baseProcessBetQueue.updateUserStakeLevel(player, balance.minBet, balance.maxBet);
        }
    }

    // TODO bring this to game service
    async insertBetLog(player, roundId, bet, rate) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            freeBet: bet.freeBet,
            roundId,
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = rate;
            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        // only this for rebet
        const processedBetLog = this.rebetProcessor.assignAmountToChoice(newBetLog, bet.oldBet);

        await this.betLogsRepository.create(processedBetLog);
    }

    // TODO bring this to game service
    async upsertBet(player, roundId, bet, rate) {
        const configs = this.gameData.gameConfigs;
        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            odds: configs.odds,
            freeBet: bet.freeBet,
            roundId,
        };
        const existingBetFilter = { uid: player.UID, roundId, freeBet: bet.freeBet };
        const existingBetIncrement = {
            totalAmount: bet.amount,
        };

        if (player.session) {
            newBet.siteId = player.session.siteId;
            newBet.currency = player.session.currencyName;
            newBet.rate = rate;

            newBet.operatorId = player.session.operatorId;
            newBet.playerId = player.session.playerId;
        }

        // only this for rebet
        const processedBetLog = this.rebetProcessor.assignAmountToChoice(newBet, bet.oldBet);

        await this.betsRepository.updateOne(
            existingBetFilter,
            { $inc: existingBetIncrement, $setOnInsert: processedBetLog },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    // TODO bring this to game service
    adjustTotalBets(player, bet, rate) {
        const { oldBet } = bet;
        Object.entries(oldBet).forEach(([betChoice, amount]) =>
            this.baseProcessBetQueue.adjustTotalBets(player, { betChoice, amount }, rate)
        );
    }

    // TODO bring this to game service
    adjustOwnBets(playerName, bet) {
        const { oldBet } = bet;

        Object.entries(oldBet).forEach(([betChoice, amount]) => this.baseProcessBetQueue.adjustOwnBets(playerName, { betChoice, amount }));
    }

    // NO CHANGE so we could remove this
    notifyPlacingBetResult(player, balance, bet, rate) {
        const result = this.generatePlacingBetResult(player, balance, bet, rate);

        this.placeBetPublisher.publishSuccessBet(player.UID, result, rate);
    }

    // TODO bring this to game service
    generatePlacingBetResult(player, balance, bet, rate) {
        const { amount, freeBet } = bet;
        const { ownBets } = this.gameData.ingame[player.profile.name] || { ownBets: {} };

        return {
            ownBets,
            endBet: amount,
            freeBet,
            user: { ...balance },
            rebet: bet.oldBet,
        };

        //TODO call super then reassign rebet
    }
}
