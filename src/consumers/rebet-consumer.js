import notices from "../constants/notices";
import { Core } from "sc-game-base";

export default class RebetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
    constructor(definition, gameData, publisher, betsRepository) {
        super(definition, gameData, publisher);

        this.betsRepository = betsRepository;
    }

    async getLastBet(player) {
        return this.betsRepository
            .findOne({
                roundId: this.gameData.roundId - 1,
                operatorId: player.session.operatorId,
                playerId: player.session.playerId,
            })
            .lean()
            .exec();
    }

    existBet(player) {
        const inGameData = this.gameData.ingame[player.profile.name];

        if (inGameData) {
            return Object.values(inGameData.betTracks).some((amount) => amount > 0);
        }

        return false;
    }

    composeValidationCriteria(player, payload) {
        const bettingTimeValidationCriteria = this.composeBettingTimeValidationCriteria(payload.roundId);
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(
            player,
            payload.lastBet,
            payload.freeBet,
            payload.amount
        );

        return bettingTimeValidationCriteria.concat(betAmountValidationCriteria);
    }

    composeBetAmountValidationCriteria(player, lastBet, freeBet, totalAmount) {
        const settings = this.gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);
        const configs = this.gameData.gameConfigs;
        const { betTracks } = this.gameData.ingame[player.profile.name] || { betTracks: {} };
        const minBet = Math.max(player.profile.minBet, settings.minBet);
        const maxBet = Math.min(player.profile.maxBet, settings.maxBet);
        const entries = Object.entries(lastBet);

        return [
            {
                failure: freeBet && !configs.enableFreeBet,
                notice: this.getNoticeObj(notices.invalidBet),
            },
            {
                failure: entries.some(
                    ([choice, amount]) =>
                        (betTracks[choice] ?? 0) + amount > Math.min(player.profile.maxBet, settings.maxBetPerChoices[choice])
                ),
                notice: this.getNoticeObj(notices.maxBetOfAnyChoiceReached),
            },
            {
                failure: entries.some(([choice, amount]) => amount < minBet),
                notice: this.getNoticeObj(notices.minBet, { minBet }),
            },
            {
                failure: totalAmount > maxBet,
                notice: this.getNoticeObj(notices.maxBet, { maxBet }),
            },
        ];
    }

    validateBetRequest(player, payload) {
        const criteria = this.composeValidationCriteria(player, payload);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    async consume(player, payload) {
        const lastBet = await this.getLastBet(player);

        if (!lastBet || this.existBet(player)) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: { errorCode: notices.invalidBet } });

            return;
        }

        Object.assign(payload, {
            amount: lastBet.totalAmount,
            freeBet: payload.freeBet ?? false,
            roundId: this.gameData.roundId,
            mode: payload.m ?? this.DisplayMode.Landscape,
            receivedTime: new Date(),
            rebet: true,
            lastBet: this.convertLastBet(lastBet),
        });

        if (!this.validateBetRequest(player, payload)) {
            return;
        }

        const { name } = player.profile;

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                currency: player.session.currencyName,
                system: player.session.system,
                betTracks: {},
                betQueue: [],

                operatorId: player.session.operatorId,
            };

            this.gameData.ingame[name] = newPlayer;
        }

        this.adjustBetTracks(player, payload.lastBet);
        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    convertLastBet(lastBet) {
        const result = {};

        this.definition.choices.forEach((choice) => {
            if (lastBet[choice] > 0) {
                result[choice] = lastBet[choice];
            }
        });

        return result;
    }

    adjustBetTracks(player, lastBet) {
        const playerInGame = this.gameData.ingame[player.profile.name];

        Object.entries(lastBet).forEach(
            ([choice, amount]) => (playerInGame.betTracks[choice] = (playerInGame.betTracks[choice] ?? 0) + amount)
        );
    }
}
