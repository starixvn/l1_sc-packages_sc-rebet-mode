import ProcessBetQueue from "./process-bet-queue";

export default class TableProcessBetQueue extends ProcessBetQueue {
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

        if (bet.rebet) {
            result.rebet = this.updateRebetGameDataChips(player, bet, rate);
        } else {
            result.ownChip = { betChoice, amount };
            this.updateGameDataChips(bet, rate);
        }

        return result;
    }

    updateRebetGameDataChips(player, bet, rate) {
        const { chips } = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);

        const rebetChips = this.rebetProcessor.convertAmountToChipList(bet.lastBet, chips);

        for (const betChoice of Object.keys(rebetChips)) {
            const chipList = rebetChips[betChoice];
            for (const chipAmount of Object.keys(chipList)) {
                for (let index = 0; index < chipList[chipAmount]; index++) {
                    this.updateGameDataChips({ betChoice, amount: chipAmount }, rate);
                }
            }
        }

        return rebetChips;
    }

    updateGameDataChips(bet, rate) {
        const { betChoice, amount } = bet;

        if (!this.gameData.chips[rate]) {
            this.gameData.chips[rate] = { [betChoice]: { amount: 1 } };
        } else {
            this.gameData.chips[rate][betChoice] = this.gameData.chips[rate][betChoice] ?? {};
            this.gameData.chips[rate][betChoice][amount] = (this.gameData.chips[rate][betChoice][amount] ?? 0) + 1;
        }
    }
}
