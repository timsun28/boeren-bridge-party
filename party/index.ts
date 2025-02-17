import type * as Party from "partykit/server";
import LobbyServer from "./lobby";
import GameServer from "./gameServer";

export default class Server implements Party.Server {
    private lobbyServer?: LobbyServer;
    private gameServer?: GameServer;

    constructor(readonly room: Party.Room) {
        if (room.id === "lobby") {
            this.lobbyServer = new LobbyServer(room);
        } else {
            this.gameServer = new GameServer(room);
        }
    }

    async onStart() {
        if (this.room.id === "lobby") return;
        await this.gameServer?.loadGame();
    }

    async onRequest(req: Party.Request): Promise<Response> {
        if (this.room.id === "lobby") {
            return this.lobbyServer?.handleRequest(req) ?? new Response("Not found", { status: 404 });
        }
        return this.gameServer?.handleRequest(req) ?? new Response("Not found", { status: 404 });
    }

    onConnect(conn: Party.Connection) {
        if (this.room.id === "lobby") {
            this.lobbyServer?.onConnect(conn);
            return;
        }
        this.gameServer?.onConnect(conn);
    }

    onMessage(message: string, sender: Party.Connection) {
        if (this.room.id === "lobby") return;
        this.gameServer?.handleMessage(message, sender);
    }
}

Server satisfies Party.Worker;
