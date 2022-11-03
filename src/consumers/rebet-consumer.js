import notices from "../constants/notices";

export default class RebetConsumer {
    constructor(definition, gameData, publisher, betsRepository, placeBetConsumer) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = publisher;
        this.betsRepository = betsRepository;
        this.placeBetConsumer = placeBetConsumer;
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

    async existBet(player) {
        const inGameData = this.gameData.ingame[player.profile.name];

        if (inGameData) {
            return Object.keys(inGameData.betTracks).length > 0;
        }

        return false;
    }

    composeValidationCriteria(player, payload) {
        const bettingTimeValidationCriteria = this.placeBetConsumer.composeBettingTimeValidationCriteria(payload.roundId);
        const betAmountValidationCriteria = this.composeBetAmountValidationCriteria(
            player,
            payload.lastBet,
            payload.freeBet,
            payload.totalAmount
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
                notice: this.placeBetConsumer.getNoticeObj(notices.invalidBet),
            },
            {
                failure: entries.some(
                    ([choice, amount]) =>
                        (betTracks[choice] ?? 0) + amount > Math.min(player.profile.maxBet, settings.maxBetPerChoices[choice])
                ),
                notice: this.placeBetConsumer.getNoticeObj(notices.maxBetOfAnyChoiceReached),
            },
            {
                failure: entries.some(([choice, amount]) => amount < minBet),
                notice: this.placeBetConsumer.getNoticeObj(notices.minBet, { minBet }),
            },
            {
                failure: totalAmount > maxBet,
                notice: this.placeBetConsumer.getNoticeObj(notices.maxBet, { maxBet }),
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

        if (!lastBet || (await this.existBet(player))) {
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
            lastBet: this.convertlastBet(lastBet),
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

        this.adjustBetTracks(player.profile.name, payload.lastBet);
        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    convertlastBet(lastBet) {
        const result = {};

        this.definition.choices.forEach((choice) => {
            if (lastBet[choice] > 0) {
                result[choice] = lastBet[choice];
            }
        });

        return result;
    }

    adjustBetTracks(playerName, lastBet) {
        const playerInGame = this.gameData.ingame[playerName];

        Object.entries(lastBet).forEach(
            ([choice, amount]) => (playerInGame.betTracks[choice] = (playerInGame.betTracks[choice] ?? 0) + amount)
        );
    }
}
