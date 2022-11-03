import { asClass } from "awilix";
import RebetConsumer from "./consumers/rebet-consumer";
import SocketRouter from "./routers/socket-router";
import { TableProcessBetQueue, ProcessBetQueue } from "./crons";
import ReBetProcessor from "./crons/rebet-processor";

export default class RebetContainerRegistry {
    register(baseSocketRouter, baseProcessBetQueue) {
        return {
            rebetConsumer: asClass(RebetConsumer).singleton(),
            socketRouter: asClass(SocketRouter).proxy(),
            baseSocketRouter: asClass(baseSocketRouter).proxy(),

            processBetQueue: asClass(ProcessBetQueue).singleton().proxy(),
            baseProcessBetQueue: asClass(baseProcessBetQueue).singleton().proxy(),
            rebetProcessor: asClass(ReBetProcessor).singleton().proxy(),
        };
    }

    registerTableGame(baseSocketRouter, baseProcessBetQueue) {
        return {
            rebetConsumer: asClass(RebetConsumer).singleton(),
            socketRouter: asClass(SocketRouter).proxy(),
            baseSocketRouter: asClass(baseSocketRouter).proxy(),

            processBetQueue: asClass(TableProcessBetQueue).singleton().proxy(),
            baseProcessBetQueue: asClass(baseProcessBetQueue).singleton().proxy(),
        };
    }
}
