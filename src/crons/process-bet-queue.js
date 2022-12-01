import { Core } from "sc-game-base";
import notice from "../constants/notices";

export default class ProcessBetQueue extends Core.Crons.ProcessBetQueue {
    processTimeOut = 50;

    constructor({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
        baseMetrics,
        rebetProcessor,
    }) {
        super({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
            userInfosRepository,
            baseMetrics,
        });

        this.rebetProcessor = rebetProcessor;
    }

    handleFailedBet(player, notice, bet) {
        const { betChoice } = bet;
        this.decreaseBetTracks(player, bet);

        if (notice.apiError) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, apiError: notice.apiError });
        } else if (notice.kickedOut) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, kickedOut: notice.kickedOut });
        } else {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, betChoice, notice });
        }
    }

    decreaseBetTracks(player, bet) {
        if (bet.rebet) {
            const { lastBet } = bet;
            Object.entries(lastBet).forEach(([betChoice, amount]) => super.decreaseBetTracks(player.profile.name, { betChoice, amount }));
        } else {
            super.decreaseBetTracks(player.profile.name, bet);
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
            rebet: !!bet.rebet,
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
            Object.entries(lastBet).forEach(([betChoice, amount]) => super.adjustTotalBets(player, { betChoice, amount }, rate));
        } else {
            super.adjustTotalBets(player, bet, rate);
        }
    }

    adjustOwnBets(playerName, bet) {
        if (bet.rebet) {
            const { lastBet } = bet;

            Object.entries(lastBet).forEach(([betChoice, amount]) => super.adjustOwnBets(playerName, { betChoice, amount }));
        } else {
            super.adjustOwnBets(playerName, bet);
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
