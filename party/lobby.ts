//@ts-nocheck
import type * as Party from "partykit/server";
import type { Game } from "@/types/game";
import { games } from "@/party/gameServer";
import { json, notFound } from "@/party/utils/response";

const GAMES_PREFIX = "games/";
const LOBBY_VERSION = "v1.0.12";

// Add singleton room ID like the chat example
export const SINGLETON_ROOM_ID = "lobby";

export default class LobbyServer implements Party.Server {
    constructor(private room: Party.Room) {
        console.log("[Lobby] Server initialized", {
            version: LOBBY_VERSION,
            roomId: room.id,
            env: process.env.PARTYKIT_ENV,
        });
    }

    async onStart() {
        console.log("[Lobby] Server starting", { version: LOBBY_VERSION });
        await this.loadGames();
        console.log("[Lobby] Server started", {
            version: LOBBY_VERSION,
            roomId: this.room.id,
            gamesLoaded: games.size,
        });
    }

    private async loadGames() {
        console.log("[Lobby] Loading games from storage", { version: LOBBY_VERSION });
        try {
            // Clear existing games to prevent stale data
            games.clear();

            // Load from storage using singleton room ID
            const gameKeys = await this.room.context.storage.list({ prefix: GAMES_PREFIX });
            console.log("[Lobby] Found game keys:", {
                version: LOBBY_VERSION,
                count: gameKeys.size,
                keys: Array.from(gameKeys.keys()),
            });

            for (const [key, game] of gameKeys) {
                const gameId = key.replace(GAMES_PREFIX, "");
                games.set(gameId, game as Game);
                console.log("[Lobby] Loaded game:", {
                    version: LOBBY_VERSION,
                    id: gameId,
                    name: (game as Game).name,
                    key,
                });
            }
        } catch (error) {
            console.error("[Lobby] Error loading games:", {
                version: LOBBY_VERSION,
                error: error instanceof Error ? error.message : error,
            });
        }
    }

    async onRequest(req: Party.Request): Promise<Response> {
        console.log("[Lobby] Handling request", {
            version: LOBBY_VERSION,
            method: req.method,
            url: req.url,
        });

        // Only allow requests to the singleton lobby
        if (this.room.id !== SINGLETON_ROOM_ID) return notFound();

        // Load games first to ensure we have latest state
        await this.loadGames();

        if (req.method === "POST") {
            try {
                const body = await req.json();
                console.log("[Lobby] Received POST request", {
                    version: LOBBY_VERSION,
                    type: body.type,
                    gameId: body.game?.id,
                });

                if (body.type === "updateGame" && body.game) {
                    const gameId = body.game.id.replace(GAMES_PREFIX, "");
                    // Store in context storage instead of room storage
                    await this.room.context.storage.put(`${GAMES_PREFIX}${gameId}`, body.game);
                    games.set(gameId, body.game);

                    // Broadcast update to all connected clients
                    const rooms = this.getAvailableRooms();
                    this.room.broadcast(
                        JSON.stringify({
                            type: "roomsUpdate",
                            rooms,
                        })
                    );

                    return json({ success: true });
                }
            } catch (error) {
                console.error("[Lobby] Error in POST handler", {
                    version: LOBBY_VERSION,
                    error: error instanceof Error ? error.message : error,
                });
                return json({ error: "Failed to process request" }, 500);
            }
        }

        // Get all games from storage
        const storedGames = await this.room.context.storage.list({ prefix: GAMES_PREFIX });
        console.log("[Lobby] Storage state", {
            version: LOBBY_VERSION,
            storedGamesCount: storedGames.size,
            storedGameIds: Array.from(storedGames.keys()),
        });

        // Update in-memory games from storage
        for (const [key, game] of storedGames) {
            const gameId = key.replace(GAMES_PREFIX, "");
            games.set(gameId, game as Game);
        }

        const rooms = this.getAvailableRooms();
        console.log("[Lobby] Available rooms", {
            version: LOBBY_VERSION,
            count: rooms.length,
            totalGames: games.size,
            rooms: rooms.map((r) => ({
                id: r.id,
                name: r.name,
                players: r.players.length,
                started: r.started,
            })),
        });

        return json({
            type: "roomsUpdate",
            rooms,
        });
    }

    async onConnect(conn: Party.Connection) {
        const connections = await this.room.getConnections();
        console.log("[Lobby] New connection", {
            version: LOBBY_VERSION,
            connectionId: conn.id,
            totalConnections: connections.size,
        });

        const rooms = this.getAvailableRooms();
        console.log("[Lobby] Sending rooms to new connection", {
            version: LOBBY_VERSION,
            connectionId: conn.id,
            roomCount: rooms.length,
        });

        conn.send(
            JSON.stringify({
                version: LOBBY_VERSION,
                type: "roomsUpdate",
                rooms,
            })
        );
    }

    private getAvailableRooms(): Game[] {
        const allGames = Array.from(games.values());
        console.log("[Lobby] Getting available rooms", {
            version: LOBBY_VERSION,
            totalGames: allGames.length,
            gamesMap: Array.from(games.entries()).map(([id, game]) => ({
                id,
                name: game.name,
                players: game.players.length,
                started: game.started,
            })),
        });

        return allGames.filter((game: Game) => !game.started).sort((a: Game, b: Game) => b.createdAt - a.createdAt);
    }
}
