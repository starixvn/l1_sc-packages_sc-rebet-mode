import systems from "../constants/systems";

export default class PlaceBetPublisher {
    constructor(basePlaceBetPublisher) {
        this.basePlaceBetPublisher = basePlaceBetPublisher;
    }

    publishSuccessBet(playerId, payload, rate) {
        this.basePlaceBetPublisher.publishToUser(playerId, payload);

        const otherUsersPayload = {
            playerId,
            rate,
            ...payload.user,
        };

        if (payload.rebet) {
            for (const [betChoice, chips] of Object.entries(payload.rebet)) {
                for (const [amount, count] of Object.entries(chips)) {
                    for (let i = 0; i < count; i++) {
                        this.basePlaceBetPublisher.publishToAllUsersExceptSystem(systems.Mobi, playerId, {
                            playerChip: { ...otherUsersPayload, betChoice, amount },
                        });
                    }
                }
            }
        } else {
            this.basePlaceBetPublisher.publishToAllUsersExceptSystem(systems.Mobi, playerId, {
                playerChip: { ...otherUsersPayload, ...payload.ownChip },
            });
        }
    }
}
