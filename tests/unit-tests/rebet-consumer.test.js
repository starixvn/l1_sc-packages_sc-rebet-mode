import mongoose from "mongoose";
import notices from "../../src/constants/notices";
import { stubMongoose } from "jest-micro-auto-stub";
import { initGameData, mockPlayer, gameSetting } from "./test-data";
import RebetConsumer from "../../src/consumers/rebet-consumer";

function initConsumer(definition, gameData, baseEventPublisher, betsRepository, placeBetConsumer) {
    return new RebetConsumer(definition, gameData, baseEventPublisher, betsRepository, placeBetConsumer);
}

describe("RebetConsumer", () => {
    const placeBetConsumer = {
        composeBettingTimeValidationCriteria: jest.fn(() => []),
        getNoticeObj: jest.fn((errorCode, extraData) => {
            return {
                errorCode,
                ...extraData,
            };
        }),
    };
    let gameData;

    const payload = {
        m: 1,
    };

    const player = mockPlayer({ minBet: 1, maxBet: 3000 });

    const baseEventPublisher = {
        publishToUser: jest.fn(),
    };
    const betsRepository = stubMongoose(mongoose.Model);
    const definition = {
        ...gameSetting,
        configName: gameSetting.name.toLowerCase(),
    };

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
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository, placeBetConsumer);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(gameData.ingame[player.profile.name]).not.toBeUndefined();
        });

        it("should adjust bettracks", async () => {
            //Arrange
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository, placeBetConsumer);

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
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository, placeBetConsumer);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(baseEventPublisher.publishToUser).toBeCalledWith(player.UID, {
                endBet: -1,
                notice: { errorCode: notices.invalidBet },
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
            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository, placeBetConsumer);

            //Act
            await consumer.consume(player, payload);

            //Assert
            expect(baseEventPublisher.publishToUser).toBeCalledWith(player.UID, {
                endBet: -1,
                notice: { errorCode: notices.invalidBet },
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

            const consumer = initConsumer(definition, gameData, baseEventPublisher, betsRepository, placeBetConsumer);

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
