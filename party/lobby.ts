import type * as Party from "partykit/server";
import type { Game } from "@/types/game";
import { games } from "@/party/gameServer";

export default class LobbyServer implements Party.Server {
    constructor(private room: Party.Room) {
        console.log("[Lobby] Server initialized", {
            roomId: room.id,
            env: process.env.PARTYKIT_ENV,
        });
    }

    async onStart() {
        console.log("[Lobby] Server started", {
            roomId: this.room.id,
            connections: this.room.connections.size,
        });
    }

    async handleRequest(req: Party.Request): Promise<Response> {
        console.log("[Lobby] Handling request", {
            method: req.method,
            url: req.url,
            headers: Object.fromEntries(req.headers.entries()),
        });

        try {
            const rooms = this.getAvailableRooms();
            console.log("[Lobby] Available rooms", {
                count: rooms.length,
                rooms: rooms.map((r) => ({
                    id: r.id,
                    name: r.name,
                    players: r.players.length,
                    started: r.started,
                })),
            });

            const response = {
                type: "roomsUpdate",
                rooms,
            };

            console.log("[Lobby] Sending response", { type: response.type, roomCount: rooms.length });
            return new Response(JSON.stringify(response), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        } catch (error) {
            console.error("[Lobby] Error in handleRequest", {
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return new Response(
                JSON.stringify({
                    error: "Internal Server Error",
                    details: error instanceof Error ? error.message : String(error),
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }
    }

    async onConnect(conn: Party.Connection) {
        console.log("[Lobby] New connection", {
            connectionId: conn.id,
            totalConnections: this.room.connections.size,
        });

        const rooms = this.getAvailableRooms();
        console.log("[Lobby] Sending rooms to new connection", {
            connectionId: conn.id,
            roomCount: rooms.length,
        });

        conn.send(
            JSON.stringify({
                type: "roomsUpdate",
                rooms,
            })
        );
    }

    private getAvailableRooms(): Game[] {
        const allGames = Array.from(games.values());
        console.log("[Lobby] Getting available rooms", {
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
