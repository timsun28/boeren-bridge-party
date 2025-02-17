//@ts-nocheck
import type * as Party from "partykit/server";
import type { Game } from "@/types/game";
import { json } from "@/party/utils/response";

export const SINGLETON_ROOM_ID = "lobby";
const LOBBY_VERSION = "v1.0.13";
const GAMES_PREFIX = "games/";

// Store games in the lobby's storage
const games = new Map<string, Game>();

export default class LobbyServer implements Party.Server {
    constructor(private room: Party.Room) {
        console.log("[Lobby] Server initialized", {
            version: LOBBY_VERSION,
            roomId: room.id,
        });
    }

    async onStart() {
        console.log("[Lobby] Server starting", { version: LOBBY_VERSION });
        await this.loadGames();
        console.log("[Lobby] Server started", {
            version: LOBBY_VERSION,
            gamesLoaded: games.size,
        });
    }

    private async loadGames() {
        console.log("[Lobby] Loading games from storage", { version: LOBBY_VERSION });
        try {
            const gameKeys = await this.room.storage.list({ prefix: GAMES_PREFIX });
            games.clear();

            for (const [key, value] of gameKeys) {
                const gameId = key.replace(GAMES_PREFIX, "");
                const game = value as Game;
                games.set(gameId, game);
            }

            console.log("[Lobby] Games loaded", {
                version: LOBBY_VERSION,
                count: games.size,
                games: Array.from(games.keys()),
            });
        } catch (error) {
            console.error("[Lobby] Error loading games:", error);
        }
    }

    async onRequest(req: Party.Request) {
        console.log("[Lobby] Handling request", {
            version: LOBBY_VERSION,
            method: req.method,
            url: req.url,
        });

        // Always load latest games before responding
        await this.loadGames();

        if (req.method === "POST") {
            const body = await req.json();
            if (body.type === "updateGame" && body.game) {
                const game = body.game as Game;
                games.set(game.id, game);
                await this.room.storage.put(`${GAMES_PREFIX}${game.id}`, game);
                this.broadcastUpdate();
                return json({ success: true });
            }
        }

        // Return all games for GET requests
        return json({
            type: "roomsUpdate",
            rooms: Array.from(games.values()),
        });
    }

    onConnect(conn: Party.Connection) {
        console.log("[Lobby] New connection", {
            version: LOBBY_VERSION,
            connectionId: conn.id,
        });

        // Send current games to new connection
        conn.send(
            JSON.stringify({
                type: "roomsUpdate",
                rooms: Array.from(games.values()),
            })
        );
    }

    private broadcastUpdate() {
        this.room.broadcast(
            JSON.stringify({
                type: "roomsUpdate",
                rooms: Array.from(games.values()),
            })
        );
    }

    onMessage(message: string, sender: Party.Connection) {
        console.log("[Lobby] Message received", {
            version: LOBBY_VERSION,
            message,
            from: sender.id,
        });
    }
}
