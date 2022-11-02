export default class SocketRouter {
    constructor({ gameData, logService, baseSocketRouter, rebetConsumer }) {
        this.gameData = gameData;
        this.logService = logService;
        this.rebetConsumer = rebetConsumer;
        this.baseSocketRouter = baseSocketRouter;
    }

    init(socketClient) {
        this.socketClient = socketClient
        this.baseSocketRouter.init(socketClient);
        socketClient.on("rebet", this.handleRebet.bind(this));
    }

    async handleRebet(payload) {
        try {
            if (!this.baseSocketRouter.verify()) {
                return;
            }

            this.rebetConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload);
        } catch (error) {
            this.logService.logError(error);
        }
    }
}
