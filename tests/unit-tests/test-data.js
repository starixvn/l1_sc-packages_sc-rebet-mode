import { UserInfo, UserSession } from "jest-auto-fixture/src/models";

export function mockPlayer(userInfoCustom = {}, userSessionCustom = {}) {
    const userInfo = UserInfo(userInfoCustom);
    const userSession = UserSession(userSessionCustom);

    return {
        UID: userInfo.UID,
        profile: { ...userInfo },
        session: { ...userSession },
    };
}

export function initGameData(player, remainingTime) {
    const defaultGameData = {
        chips: {},
        players: {},
        remainingTime,
        totalBets: {},
        ingame: {},
    };

    defaultGameData.gameConfigs = {
        type: 1,
        name: "megakeno",
        enabled: true,
        botenabled: true,
        minbet: 1,
        maxbet: 2000,
        bot_maxbet: 500,
        choices_maxbet: {
            big: 2000,
            small: 2000,
            even: 2000,
            odd: 2000,
            earth: 500,
            fire: 1500,
            gold: 500,
            water: 2000,
            wood: 2000,
        },
        odds: {
            big: 1.97,
            small: 1.97,
            even: 1.97,
            odd: 1.97,
            earth: 9.3,
            fire: 4.7,
            gold: 9.3,
            water: 2.5,
            wood: 4.7,
        },
        delayStartTime: 0,
        gameId: 52,
        randomMode: 2,
    };
    defaultGameData.currencyGroupGames = [
        {
            groupId: player.session.currencyGroupId,
            gameId: 52,
            gameName: "megakeno",
            enabled: true,
            minBet: 1,
            maxBet: 5000,
            maxBetPerChoices: {
                big: 5000,
                small: 5000,
                even: 1000,
                odd: 1000,
                earth: 1000,
                fire: 2000,
                gold: 1000,
                water: 5000,
                wood: 2000,
            },
            chips: ["1", "5", "10", "50", "100", "500", "1000", "2000"],
        },
    ];

    return defaultGameData;
}

export const gameSetting = {
    id: 52,
    name: "MegaKeno",
    durations: { wholeRound: 58, placingBets: 45, lockingBet: 5 },
    choices: ["big", "small", "odd", "even", "gold", "wood", "water", "fire", "earth"],
    choicesMapper: {
        big: 1,
        small: 2,
        odd: 3,
        even: 4,
        gold: 5,
        wood: 6,
        water: 7,
        fire: 6,
        earth: 7,
    },
    hedgeBetGroups: [
        ["big", "small"],
        ["even", "odd"],
    ],
    defaultBetTracks: {},
};
