export default class RebetProcessor {
    assignAmountToChoice(betLog, rebet) {
        Object.entries(rebet).forEach(([choice, amount]) => (betLog[choice] = amount));

        return betLog;
    }

    convertAmountToChipList(bet, chipConfiguration) {
        const rebetChips = {};
        const sortedChips = chipConfiguration.map((x) => parseInt(x)).sort((num1, num2) => num2 - num1);

        for (const [betChoice, betAmount] of Object.entries(bet)) {
            rebetChips[betChoice] = {};
            let amount = betAmount;

            while (amount > 0) {
                const chip = sortedChips.find((chip) => chip <= amount);
                amount -= chip;
                rebetChips[betChoice][chip] = (rebetChips[betChoice][chip] ?? 0) + 1;
            }
        }

        return rebetChips;
    }

    flattenChips(rebetChips) {
        const chips = [];

        for (const betChoice of Object.keys(rebetChips)) {
            const chipList = rebetChips[betChoice];
            for (const chipAmount of Object.keys(chipList)) {
                for (let index = 0; index < chipList[chipAmount]; index++) {
                    chips.push({ betChoice, amount: chipAmount });
                }
            }
        }

        return chips;
    }
}
