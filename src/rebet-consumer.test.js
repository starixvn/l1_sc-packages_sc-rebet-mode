import { helpers } from "sc-common";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import RebetConsumer from "../../src/consumers/rebet-consumer";
import { GameDefinition } from "sc-multiple-games-base";
import { Core } from "sc-game-base";
import mongoose from "mongoose";
import gameSettings from "../../src/game-settings";
import notices from "../../src/constants/notices";
import { initGameData, mockPlayer } from "./test-data";

function initConsumer(definition, gameData, baseEventPublisher, betsRepository) {
    return new RebetConsumer(definition, gameData, baseEventPublisher, betsRepository);
}

describe("PlaceBetConsumer", () => {
    const gameSetting = gameSettings.find((x) => x.id === 52);
    let gameData;

    const payload = {
        m: 1,
    };

    const player = mockPlayer({ minBet: 1, maxBet: 3000 });

    const baseEventPublisher = stub(Core.BaseEventPublishers.BaseEventPublisher);
    const betsRepository = stubMongoose(mongoose.Model);
    const definition = new GameDefinition(gameSetting);

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("when bet is valid", () => {
        const oldBet = {
            big: 1,
            odd: 10,
            totalAmount: 11,
        };

        betsRepository.findOne().lean().exec.mockReturnValue(oldBet);
        gameData = initGameData(player, definition.durations.placingBets - 2);
        gameData.roundId = 100;

        it("should add to ingame", async () => {
            //Arrange
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(gameData.ingame[player.profile.name]).not.toBeUndefined();
        });

        it("should adjust bettracks", async () => {
            //Arrange
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(gameData.ingame[player.profile.name].betTracks).toStrictEqual({ big: 1, odd: 10 });
        });

        afterAll(() => {
            betsRepository.findOne().lean().exec.mockReset();
        });
    });

    describe("when bet in previous round doesnt exist", () => {
        it("should publish invalidBet error to user", async () => {
            //Arrange
            gameData = initGameData(player, definition.durations.placingBets - 2);
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(baseEventPublisher.publishToUser).toBeCalledWith(player.UID, {
                endBet: -1,
                notice: { errorCode: helpers.noticeHelper.invalidBet },
            });
        });
    });

    describe("when player has already placed bet", () => {
        it("should publish invalidBet error to user", async () => {
            //Arrange
            gameData = initGameData(player, definition.durations.placingBets - 2);
            gameData.ingame[player.profile.name] = {
                betTracks: {
                    big: 100,
                },
            };
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(baseEventPublisher.publishToUser).toBeCalledWith(player.UID, {
                endBet: -1,
                notice: { errorCode: helpers.noticeHelper.invalidBet },
            });
        });
    });

    describe("when old bet has amount on choice that exceeds current max bet", () => {
        it("should publish maxBetOfAnyChoiceReached error to user", async () => {
            //Arrange
            const oldBet = {
                even: 2000,
                totalAmount: 2000,
            };
            betsRepository.findOne().lean().exec.mockReturnValueOnce(oldBet);

            gameData = initGameData(player, definition.durations.placingBets - 2);

            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(baseEventPublisher.publishToUser).toBeCalledWith(player.UID, {
                endBet: -1,
                notice: { errorCode: notices.maxBetOfAnyChoiceReached },
            });
        });
    });
});
