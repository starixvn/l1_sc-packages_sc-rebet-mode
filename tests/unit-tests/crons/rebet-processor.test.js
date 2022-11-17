import RebetProcessor from "../../../src/crons/rebet-processor";

describe("RebetProcessor", () => {
    const rebetProcessor = new RebetProcessor();

    describe("assignAmountToChoice", () => {
        it("assign amount to corresponding choice", () => {
            // Arrange
            const bet = { odd: 100, even: 1200 };
            const playerInfo = { playerId: 21000 };
            const expected = { ...playerInfo, ...bet };

            // Act
            const result = rebetProcessor.assignAmountToChoice(playerInfo, bet);

            // Assert
            expect(result).toStrictEqual(expected);
        });
    });

    describe("convertAmountToChipList", () => {
        it("convert chips by amount on bet choice", () => {
            // Arrange
            const bet = { odd: 100, even: 1200 };
            const chipConfig = ["1", "5", "10", "50", "100", "500", "1000", "2000"];
            const expected = { odd: { 100: 1 }, even: { 1000: 1, 100: 2 } };

            // Act
            const result = rebetProcessor.convertAmountToChipList(bet, chipConfig);

            // Assert
            expect(result).toStrictEqual(expected);
        });
    });

    describe("flattenChips", () => {
        it("should return list of bet choice and amount", () => {
            // Arrange
            const rebetChips = { odd: { 100: 1 }, even: { 1000: 1, 100: 2 } };
            const expected = [
                { betChoice: "odd", amount: "100" },
                { betChoice: "even", amount: "100" },
                { betChoice: "even", amount: "100" },
                { betChoice: "even", amount: "1000" },
            ];

            // Act
            const result = rebetProcessor.flatChips(rebetChips);

            // Assert
            expect(result).toStrictEqual(expected);
        });
    });
});
