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

        this.baseProcessBetQueue.baseFunctions = {
            decreaseBetTracks: this.baseProcessBetQueue.decreaseBetTracks.bind(this.baseProcessBetQueue),
            insertBetLog: this.baseProcessBetQueue.insertBetLog.bind(this.baseProcessBetQueue),
            upsertBet: this.baseProcessBetQueue.upsertBet.bind(this.baseProcessBetQueue),
            adjustTotalBets: this.baseProcessBetQueue.adjustTotalBets.bind(this.baseProcessBetQueue),
            adjustOwnBets: this.baseProcessBetQueue.adjustOwnBets.bind(this.baseProcessBetQueue),
            generatePlacingBetResult: this.baseProcessBetQueue.generatePlacingBetResult.bind(this.baseProcessBetQueue),
        };

        this.baseProcessBetQueue.rebetProcessor = this.rebetProcessor;
        this.baseProcessBetQueue.decreaseBetTracks = this.decreaseBetTracks;
        this.baseProcessBetQueue.insertBetLog = this.insertBetLog;
        this.baseProcessBetQueue.upsertBet = this.upsertBet;
        this.baseProcessBetQueue.adjustTotalBets = this.adjustTotalBets;
        this.baseProcessBetQueue.adjustOwnBets = this.adjustOwnBets;
        this.baseProcessBetQueue.generatePlacingBetResult = this.generatePlacingBetResult;
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
                    this.baseProcessBetQueue
                        .proceedBet(player, payload)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(this.logService.logError);
                }
            });
        }
    }

    decreaseBetTracks(playerName, bet) {
        if (bet.rebet) {
            const { lastBet } = bet;
            Object.entries(lastBet).forEach(([betChoice, amount]) =>
                this.baseFunctions.decreaseBetTracks(playerName, { betChoice, amount })
            );
        } else {
            this.baseFunctions.decreaseBetTracks(playerName, bet);
        }
    }

    async insertBetLog(player, roundId, bet, rate) {
        let newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            freeBet: bet.freeBet,
            roundId,
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
            rebet: false,
        };

        if (bet.rebet) {
            newBetLog.rebet = true;
            newBetLog = this.rebetProcessor.assignAmountToChoice(newBetLog, bet.lastBet);
        } else {
            newBetLog[bet.betChoice] = bet.amount;
        }

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = rate;
            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }

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
        let existingBetIncrement = {
            totalAmount: bet.amount,
        };

        if (bet.rebet) {
            existingBetIncrement = this.rebetProcessor.assignAmountToChoice(existingBetIncrement, bet.lastBet);
        } else {
            existingBetIncrement[bet.betChoice] = bet.amount;
        }

        if (player.session) {
            newBet.siteId = player.session.siteId;
            newBet.currency = player.session.currencyName;
            newBet.rate = rate;

            newBet.operatorId = player.session.operatorId;
            newBet.playerId = player.session.playerId;
        }

        await this.betsRepository.updateOne(
            existingBetFilter,
            { $inc: existingBetIncrement, $setOnInsert: newBet },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    adjustTotalBets(player, bet, rate) {
        if (bet.rebet) {
            const { lastBet } = bet;
            Object.entries(lastBet).forEach(([betChoice, amount]) =>
                this.baseFunctions.adjustTotalBets(player, { betChoice, amount }, rate)
            );
        } else {
            this.baseFunctions.adjustTotalBets(player, bet, rate);
        }
    }

    adjustOwnBets(playerName, bet) {
        if (bet.rebet) {
            const { lastBet } = bet;

            Object.entries(lastBet).forEach(([betChoice, amount]) => this.baseFunctions.adjustOwnBets(playerName, { betChoice, amount }));
        } else {
            this.baseFunctions.adjustOwnBets(playerName, bet);
        }
    }

    generatePlacingBetResult(player, balance, bet, rate) {
        const { amount, freeBet, betChoice } = bet;
        const { ownBets } = this.gameData.ingame[player.profile.name] || { ownBets: {} };

        return {
            ownBets: ownBets,
            endBet: amount,
            betChoice,
            freeBet,
            user: { ...balance },
            rebet: bet.lastBet,
        };
    }
}
