import type * as Party from "partykit/server";
import LobbyServer, { SINGLETON_ROOM_ID } from "./lobby";
import GameServer from "./gameServer";

export default class MainServer implements Party.Server {
    private lobbyServer?: LobbyServer;
    private gameServer?: GameServer;

    constructor(private room: Party.Room) {
        if (room.id === SINGLETON_ROOM_ID) {
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
        if (this.room.id === SINGLETON_ROOM_ID) {
            return this.lobbyServer?.onRequest(req) ?? new Response("Not found", { status: 404 });
        }
        return this.gameServer?.onRequest(req) ?? new Response("Not found", { status: 404 });
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

MainServer satisfies Party.Worker;
