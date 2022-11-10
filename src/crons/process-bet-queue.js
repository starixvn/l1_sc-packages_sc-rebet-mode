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

        this.baseFunctions = {
            decreaseBetTracks: this.baseProcessBetQueue.decreaseBetTracks,
            insertBetLog: this.baseProcessBetQueue.insertBetLog,
            upsertBet: this.baseProcessBetQueue.upsertBet,
            adjustTotalBets: this.baseProcessBetQueue.adjustTotalBets,
            adjustOwnBets: this.baseProcessBetQueue.adjustOwnBets,
            generatePlacingBetResult: this.baseProcessBetQueue.generatePlacingBetResult,
            updateGameDataChips: this.baseProcessBetQueue.updateGameDataChips,
        };
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
                        this.baseProcessBetQueue.decreaseBetTracks = this.decreaseBetTracks.bind(this);
                        this.baseProcessBetQueue.insertBetLog = this.insertBetLog.bind(this);
                        this.baseProcessBetQueue.upsertBet = this.upsertBet.bind(this);
                        this.baseProcessBetQueue.adjustTotalBets = this.adjustTotalBets.bind(this);
                        this.baseProcessBetQueue.adjustOwnBets = this.adjustOwnBets.bind(this);
                        this.baseProcessBetQueue.generatePlacingBetResult = this.generatePlacingBetResult.bind(this);
                    } else {
                        this.baseProcessBetQueue.decreaseBetTracks = this.baseFunctions.decreaseBetTracks.bind(this.baseProcessBetQueue);
                        this.baseProcessBetQueue.insertBetLog = this.baseFunctions.insertBetLog.bind(this.baseProcessBetQueue);
                        this.baseProcessBetQueue.upsertBet = this.baseFunctions.upsertBet.bind(this.baseProcessBetQueue);
                        this.baseProcessBetQueue.adjustTotalBets = this.baseFunctions.adjustTotalBets.bind(this.baseProcessBetQueue);
                        this.baseProcessBetQueue.adjustOwnBets = this.baseFunctions.adjustOwnBets.bind(this.baseProcessBetQueue);
                        this.baseProcessBetQueue.generatePlacingBetResult = this.baseFunctions.generatePlacingBetResult.bind(
                            this.baseProcessBetQueue
                        );
                    }

                    this.baseProcessBetQueue
                        .proceedBet(player, payload)
                        .then(() => (playerInGame.betProcessing = false))
                        .catch(this.logService.logError);
                }
            });
        }
    }

    decreaseBetTracks(playerName, bet) {
        const { lastBet } = bet;
        Object.entries(lastBet).forEach(([betChoice, amount]) =>
            this.baseFunctions.decreaseBetTracks.bind(this.baseProcessBetQueue)(playerName, { betChoice, amount })
        );
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

        newBetLog.rebet = true;
        newBetLog = this.rebetProcessor.assignAmountToChoice(newBetLog, bet.lastBet);

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

        existingBetIncrement = this.rebetProcessor.assignAmountToChoice(existingBetIncrement, bet.lastBet);

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
        const { lastBet } = bet;
        Object.entries(lastBet).forEach(([betChoice, amount]) =>
            this.baseFunctions.adjustTotalBets.bind(this.baseProcessBetQueue)(player, { betChoice, amount }, rate)
        );
    }

    adjustOwnBets(playerName, bet) {
        const { lastBet } = bet;
        Object.entries(lastBet).forEach(([betChoice, amount]) =>
            this.baseFunctions.adjustOwnBets.bind(this.baseProcessBetQueue)(playerName, { betChoice, amount })
        );
    }

    generatePlacingBetResult(player, balance, bet, rate) {
        const { amount, freeBet, betChoice } = bet;
        const { ownBets } = this.gameData.ingame[player.profile.name] || { ownBets: {} };

        const result = {
            ownBets,
            endBet: amount,
            betChoice,
            freeBet,
            user: { ...balance },
            rebet: null,
        };

        if (this.gameData.players[player.UID]) {
            this.gameData.players[player.UID].red = balance.red;
        }

        result.rebet = this.updateRebetGameDataChips(player, bet, rate);

        return result;
    }

    updateRebetGameDataChips(player, bet, rate) {
        const { chips } = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);

        const rebetChips = this.rebetProcessor.convertAmountToChipList(bet.lastBet, chips);

        for (const betChoice of Object.keys(rebetChips)) {
            const chipList = rebetChips[betChoice];
            for (const chipAmount of Object.keys(chipList)) {
                for (let index = 0; index < chipList[chipAmount]; index++) {
                    this.baseFunctions.updateGameDataChips.bind(this.baseProcessBetQueue)({ betChoice, amount: chipAmount }, rate);
                }
            }
        }

        return rebetChips;
    }
}
