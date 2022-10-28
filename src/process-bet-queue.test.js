import { stub, stubMongoose } from "jest-micro-auto-stub";
import { GameDefinition } from "sc-multiple-games-base";
import { Core } from "sc-game-base";
import mongoose from "mongoose";
import gameSettings from "../../src/game-settings";
import { initGameData, mockPlayer } from "./test-data";
import ProcessBetQueue from "../../src/crons/process-bet-queue";

function initBetQueue(
    definition,
    gameData,
    placeBetPublisher,
    placeBet,
    logService,
    betsRepository,
    betLogsRepository,
    userInfosRepository
) {
    return new ProcessBetQueue({
        definition,
        gameData,
        placeBetPublisher,
        placeBet,
        logService,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
    });
}

describe("ProcessBetQueue", () => {
    const gameSetting = gameSettings.find((x) => x.id === 52);

    const player = mockPlayer();
    let gameData = initGameData(player, gameSetting.durations.placingBets);

    const placeBetPublisher = stub(Core.BaseEventPublishers.PlaceBetPublisher);
    const placeBet = jest.fn();
    const betsRepository = stubMongoose(mongoose.Model);
    const betLogsRepository = stubMongoose(mongoose.Model);
    const userInfosRepository = stubMongoose(mongoose.Model);
    const definition = new GameDefinition(gameSetting);

    afterEach(() => {
        jest.clearAllMocks();
        gameData = initGameData(player, gameSetting.durations.placingBets);
    });

    describe("insertBetLog", () => {
        describe("normal bet", () => {
            it("should call insertBetLog", async () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    placeBet,
                    null,
                    betsRepository,
                    betLogsRepository,
                    userInfosRepository
                );

                //Act
                await processBetQueue.insertBetLog(player, 1, { amount: 100, betChoice: "big" }, 1);

                //Assert
                expect(betLogsRepository.create).toBeCalled();
            });
        });
        describe("re bet", () => {
            it("should call insertBetLog", async () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    placeBet,
                    null,
                    betsRepository,
                    betLogsRepository,
                    userInfosRepository
                );

                //Act
                await processBetQueue.insertBetLog(player, 1, { rebet: true, oldBet: { big: 100 } }, 1);

                //Assert
                expect(betLogsRepository.create).toBeCalled();
            });
        });
    });

    describe("generatePlacingBetResult", () => {
        describe("normal bet", () => {
            it("result should have ownchip", () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    placeBet,
                    null,
                    betsRepository,
                    betLogsRepository,
                    userInfosRepository
                );

                //Act
                const result = processBetQueue.generatePlacingBetResult(player, { red: 3000 }, { amount: 100, betChoice: "big" }, 1);

                //Assert
                expect(result.ownChip).toEqual({ amount: 100, betChoice: "big" });
            });

            it("gameData.chips should have been updated correctly", () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    placeBet,
                    null,
                    betsRepository,
                    betLogsRepository,
                    userInfosRepository
                );

                //Act
                processBetQueue.generatePlacingBetResult(player, { red: 3000 }, { amount: 100, betChoice: "big" }, 1);

                //Assert
                expect(gameData.chips).toEqual({ 1: { big: { 100: 1 } } });
            });
        });

        describe("re bet", () => {
            it("result should have rebet", () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    placeBet,
                    null,
                    betsRepository,
                    betLogsRepository,
                    userInfosRepository
                );

                //Act
                const result = processBetQueue.generatePlacingBetResult(
                    player,
                    { red: 3000 },
                    { rebet: true, oldBet: { big: 100, odd: 200 } },
                    1
                );

                //Assert
                expect(result.rebet).toEqual({ big: { 100: 1 }, odd: { 100: 2 } });
            });

            it("gameData.chips should have been updated correctly", () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    placeBet,
                    null,
                    betsRepository,
                    betLogsRepository,
                    userInfosRepository
                );

                //Act
                processBetQueue.generatePlacingBetResult(player, { red: 3000 }, { rebet: true, oldBet: { big: 100, odd: 200 } }, 1);

                //Assert
                expect(gameData.chips).toEqual({ 1: { big: { 100: 1 }, odd: { 100: 2 } } });
            });
        });
    });
});
