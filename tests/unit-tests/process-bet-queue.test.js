import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { TableProcessBetQueue } from "../../src/crons";
import { gameSetting, initGameData, mockPlayer } from "./test-data";

function initBetQueue(definition, gameData, placeBetPublisher, betsRepository, betLogsRepository, baseProcessBetQueue) {
    return new TableProcessBetQueue({
        definition,
        gameData,
        placeBetPublisher,
        betsRepository,
        betLogsRepository,
        baseProcessBetQueue,
    });
}

describe("ProcessBetQueue", () => {
    const player = mockPlayer();
    let gameData = initGameData(player, gameSetting.durations.placingBets);

    const placeBetPublisher = {};
    const baseProcessBetQueue = {
        formatApiBetInfo: function (payload) {
            return {
                amount: payload.amount,
                gameId: definition.id,
                gameRoundId: payload.roundId,
                choiceId: definition.choicesMapper[payload.betChoice],
                freeBet: payload.freeBet,
                clientSentTime: payload.time ?? new Date(),
                metadata: {
                    mode: `${payload.mode}`,
                },
            };
        },
        proceedBet: jest.fn(),
        validateBetRequest: () => true,
        updateGameDataChips: function (bet, rate) {
            const { betChoice, amount } = bet;

            if (!gameData.chips[rate]) {
                gameData.chips[rate] = { [betChoice]: { [amount]: 1 } };
            } else {
                gameData.chips[rate][betChoice] = gameData.chips[rate][betChoice] ?? {};
                gameData.chips[rate][betChoice][amount] = (gameData.chips[rate][betChoice][amount] ?? 0) + 1;
            }
        },
        adjustTotalBets: jest.fn(),
        adjustOwnBets: jest.fn(),
        decreaseBetTracks: jest.fn(),
    };
    const betsRepository = stubMongoose(mongoose.Model);
    const betLogsRepository = stubMongoose(mongoose.Model);
    const definition = {
        ...gameSetting,
        configName: gameSetting.name.toLowerCase(),
    };

    afterEach(() => {
        jest.clearAllMocks();
        gameData = initGameData(player, gameSetting.durations.placingBets);
    });

    describe("insertBetLog", () => {
        describe("re bet", () => {
            it("should call insertBetLog", async () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    betsRepository,
                    betLogsRepository,
                    baseProcessBetQueue
                );

                //Act
                await processBetQueue.insertBetLog(player, 1, { rebet: true, lastBet: { big: 100 } }, 1);

                //Assert
                expect(betLogsRepository.create).toBeCalled();
            });
        });
    });

    describe("upsertBet", () => {
        describe("re bet", () => {
            it("should call upsertBet", async () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    betsRepository,
                    betLogsRepository,
                    baseProcessBetQueue
                );

                //Act
                await processBetQueue.upsertBet(player, 1, { rebet: true, lastBet: { big: 100 } }, 1);

                //Assert
                expect(betsRepository.updateOne).toBeCalled();
            });
        });
    });

    describe("generatePlacingBetResult", () => {
        describe("re bet", () => {
            it("result should have rebet", () => {
                //Arrange
                const processBetQueue = initBetQueue(
                    definition,
                    gameData,
                    placeBetPublisher,
                    betsRepository,
                    betLogsRepository,
                    baseProcessBetQueue
                );

                //Act
                const result = processBetQueue.generatePlacingBetResult(
                    player,
                    { red: 3000 },
                    { rebet: true, lastBet: { big: 100, odd: 200 } },
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
                    betsRepository,
                    betLogsRepository,
                    baseProcessBetQueue
                );

                //Act
                processBetQueue.generatePlacingBetResult(player, { red: 3000 }, { rebet: true, lastBet: { big: 100, odd: 200 } }, 1);

                //Assert
                expect(gameData.chips).toEqual({ 1: { big: { 100: 1 }, odd: { 100: 2 } } });
            });
        });
    });

    describe("adjustTotalBets", () => {
        it("should call baseProcessBetQueue.adjustTotalBets", () => {
            //Arrange
            const processBetQueue = initBetQueue(
                definition,
                gameData,
                placeBetPublisher,
                betsRepository,
                betLogsRepository,
                baseProcessBetQueue
            );

            //Act
            processBetQueue.adjustTotalBets(
                player,
                {
                    lastBet: {
                        big: 100,
                        odd: 200,
                    },
                },
                1
            );

            //Assert
            expect(baseProcessBetQueue.adjustTotalBets).toHaveBeenCalledTimes(2);
        });
    });

    describe("adjustOwnBets", () => {
        it("should call baseProcessBetQueue.adjustOwnBets", () => {
            //Arrange
            const processBetQueue = initBetQueue(
                definition,
                gameData,
                placeBetPublisher,
                betsRepository,
                betLogsRepository,
                baseProcessBetQueue
            );

            //Act
            processBetQueue.adjustOwnBets(
                player,
                {
                    lastBet: {
                        big: 100,
                        odd: 200,
                    },
                },
                1
            );

            //Assert
            expect(baseProcessBetQueue.adjustOwnBets).toHaveBeenCalledTimes(2);
        });
    });

    describe("decreaseBetTracks", () => {
        it("should call baseProcessBetQueue.decreaseBetTracks", () => {
            //Arrange
            const processBetQueue = initBetQueue(
                definition,
                gameData,
                placeBetPublisher,
                betsRepository,
                betLogsRepository,
                baseProcessBetQueue
            );

            //Act
            processBetQueue.decreaseBetTracks(player, {
                lastBet: {
                    big: 100,
                    odd: 200,
                },
            });

            //Assert
            expect(baseProcessBetQueue.decreaseBetTracks).toHaveBeenCalledTimes(2);
        });
    });
});
