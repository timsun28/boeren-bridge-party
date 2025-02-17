import type * as Party from "partykit/server";
import LobbyServer, { SINGLETON_ROOM_ID } from "./lobby";
import GameServer from "./gameServer";

export default class MainServer implements Party.Server {
    private lobbyServer?: LobbyServer;
    private gameServer?: GameServer;

    constructor(private room: Party.Room) {
        console.log("[Main] Initializing server", {
            roomId: room.id,
            isSingleton: room.id === SINGLETON_ROOM_ID,
        });
        
        if (room.id === SINGLETON_ROOM_ID) {
            this.lobbyServer = new LobbyServer(room);
        } else {
            this.gameServer = new GameServer(room);
        }
    }

    async onStart() {
        if (this.lobbyServer) {
            await this.lobbyServer.onStart();
        } else if (this.gameServer) {
            await this.gameServer.onStart();
        }
    }

    async onRequest(req: Party.Request): Promise<Response> {
        if (this.lobbyServer) {
            return this.lobbyServer.onRequest(req);
        } else if (this.gameServer) {
            return this.gameServer.onRequest(req);
        }
        return new Response("Not found", { status: 404 });
    }

    onConnect(conn: Party.Connection) {
        if (this.lobbyServer) {
            this.lobbyServer.onConnect(conn);
        } else if (this.gameServer) {
            this.gameServer.onConnect(conn);
        }
    }

    onMessage(message: string, sender: Party.Connection) {
        if (this.lobbyServer) {
            this.lobbyServer.onMessage(message, sender);
        } else if (this.gameServer) {
            this.gameServer.onMessage(message, sender);
        }
    }
}

MainServer satisfies Party.Worker;
