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

    updateRebetGameDataChips(player, bet, rate) {
        const rebetChips = {};

        const chips = this.gameData.currencyGroupGames
            .find((x) => x.groupId.toString() === player.session.currencyGroupId)
            .chips.map((x) => parseInt(x))
            .sort((num1, num2) => num2 - num1);

        for (const [betChoice, betAmount] of Object.entries(bet.oldBet)) {
            rebetChips[betChoice] = {};
            let amount = betAmount;

            while (amount > 0) {
                const chip = chips.find((chip) => chip <= amount);
                amount -= chip;
                this.baseProcessBetQueue.updateGameDataChips({ betChoice, amount: chip }, rate);
                rebetChips[betChoice][chip] = (rebetChips[betChoice][chip] ?? 0) + 1;
            }
        }

        return rebetChips;
    }
}
