import TableProcessBetQueue from "./table-process-bet-queue";

export default class TableProcessBetQueueSeparateBetLog extends TableProcessBetQueue {
    async insertBetLog(player, roundId, bet, rate) {
        if (bet.rebet) {
            return Object.entries(bet.lastBet).forEach(async ([choice, amount]) => {
                const betTmp = { ...bet };
                betTmp.betChoice = choice;
                betTmp.amount = amount;
                await this.insertBetLogRecord(player, roundId, betTmp, rate, true);
            });
        }

        return this.insertBetLogRecord(player, roundId, bet, rate, false);
    }

    async insertBetLogRecord(player, roundId, bet, rate, rebet) {
        const newBetLog = {
            uid: player.UID,
            name: player.profile.name,
            time: new Date(),
            choice: bet.betChoice,
            amount: bet.amount,
            freeBet: bet.freeBet,
            clientSentTime: bet.clientSentTime,
            receivedTime: bet.receivedTime,
            roundId,
            rebet,
        };

        if (player.session) {
            newBetLog.siteId = player.session.siteId;
            newBetLog.currency = player.session.currencyName;
            newBetLog.rate = rate;

            newBetLog.operatorId = player.session.operatorId;
            newBetLog.playerId = player.session.playerId;
        }

        await this.betLogsRepository.create(newBetLog);
    }
}
