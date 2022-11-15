import { asClass } from "awilix";
import RebetConsumer from "./consumers/rebet-consumer";
import SocketRouter from "./routers/socket-router";
import { TableProcessBetQueue, ProcessBetQueue, ReBetProcessor } from "./crons";
import { PlaceBetPublisher } from "./publishers";

export default class RebetContainerRegistry {
    register(baseSocketRouter) {
        return {
            rebetConsumer: asClass(RebetConsumer).singleton(),
            socketRouter: asClass(SocketRouter).proxy(),
            baseSocketRouter: asClass(baseSocketRouter).proxy(),

            rebetProcessor: asClass(ReBetProcessor).singleton().proxy(),
            processBetQueue: asClass(ProcessBetQueue).singleton().proxy(),
            baseProcessBetQueue: asClass(baseProcessBetQueue).singleton().proxy(),
        };
    }

    registerTableGame(baseSocketRouter, baseProcessBetQueue, basePlaceBetPublisher) {
        return {
            rebetConsumer: asClass(RebetConsumer).singleton(),
            socketRouter: asClass(SocketRouter).proxy(),
            baseSocketRouter: asClass(baseSocketRouter).proxy(),

            rebetProcessor: asClass(ReBetProcessor).singleton().proxy(),
            processBetQueue: asClass(TableProcessBetQueue).singleton().proxy(),
            baseProcessBetQueue: asClass(baseProcessBetQueue).singleton().proxy(),

            placeBetPublisher: asClass(PlaceBetPublisher).singleton(),
            basePlaceBetPublisher: asClass(basePlaceBetPublisher).singleton(),
        };
    }
}
