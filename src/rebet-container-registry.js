import { asClass } from "awilix";
import RebetConsumer from "./consumers/rebet-consumer";
import SocketRouter from "./routers/socket-router";
import ReBetProcessor from "./crons/rebet-processor";

export default class RebetContainerRegistry {
    register(baseSocketRouter) {
        return {
            rebetConsumer: asClass(RebetConsumer).singleton(),
            socketRouter: asClass(SocketRouter).proxy(),
            baseSocketRouter: asClass(baseSocketRouter).proxy(),

            rebetProcessor: asClass(ReBetProcessor).singleton().proxy(),
        };
    }
}
