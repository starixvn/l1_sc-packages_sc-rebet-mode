import { Table } from "sc-game-base";
import TableProcessBetQueue from "../../../src/crons/table-process-bet-queue";
import { initGameData, mockPlayer } from "../test-data";

describe("TableProcessBetQueue", () => {
    const definition = new Table.TableGameDefinition({ name: "game name" });
    const player = mockPlayer();
    const gameData = initGameData(player, 10);

    const betQueue = new TableProcessBetQueue({
        definition,
        gameData,
    });

    describe("updateGameDataChips", () => {
        it("should increase amount of chip", () => {
            // Arrange
            const bet = { betChoice: "odd", amount: 10 };
            const rate = 1;

            // Act
            betQueue.updateGameDataChips(bet, rate);

            // Assert
            expect(betQueue.gameData.chips[rate][bet.betChoice][bet.amount]).toBe(1);
        });
    });
});
