import { Core, Constants } from "sc-game-base";

export default class TablePlaceBetPublisher extends Core.BaseEventPublishers.PlaceBetPublisher {
    publishSuccessBet(playerId, payload, rate) {
        this.publishToUser(playerId, payload);

        const otherUsersPayload = {
            playerId,
            rate,
            ...payload.user,
        };

        if (payload.rebet) {
            for (const [betChoice, chips] of Object.entries(payload.rebet)) {
                for (const [amount, count] of Object.entries(chips)) {
                    for (let i = 0; i < count; i++) {
                        this.publishToAllUsersExceptSystem(Constants.Systems.Mobi, playerId, {
                            playerChip: { ...otherUsersPayload, betChoice, amount },
                        });
                    }
                }
            }
        } else {
            this.publishToAllUsersExceptSystem(Constants.Systems.Mobi, playerId, {
                playerChip: { ...otherUsersPayload, ...payload.ownChip },
            });
        }
    }
}
