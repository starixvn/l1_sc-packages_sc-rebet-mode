import ProcessBetQueue from "./process-bet-queue";

export default class TableProcessBetQueue extends ProcessBetQueue {
    generatePlacingBetResult(player, balance, bet, rate) {
        const result = super.generatePlacingBetResult(player, balance, bet, rate);

        result.rebet = this.updateRebetGameDataChips(player, bet, rate);

        if (this.gameData.players[player.UID]) {
            this.gameData.players[player.UID].red = balance.red;
        }

        return result;
    }

    // TODO move this function to game service
    updateRebetGameDataChips(player, bet, rate) {
        const { chips } = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);

        const rebetChips = this.rebetProcessor.convertAmountToChipList(bet.oldBet, chips);

        for (const betChoice of Object.keys(rebetChips)) {
            const chipList = rebetChips[betChoice];
            //{ 1000: 1, 100: 2 } }
            for (const chipAmount of Object.keys(chipList)) {
                for (let index = 0; index < chipList[chipAmount]; index++) {
                    this.baseProcessBetQueue.updateGameDataChips({ betChoice, amount: chipAmount }, rate);
                }
            }
        }

        return rebetChips;
    }
}
