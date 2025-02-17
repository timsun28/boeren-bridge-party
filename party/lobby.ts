import type * as Party from "partykit/server";
import type { Game } from "@/types/game";
import { games } from "@/party/gameServer";

export default class LobbyServer implements Party.Server {
    constructor(private room: Party.Room) {
        console.log("LobbyServer initialized");
    }

    async onStart() {
        console.log("LobbyServer started");
    }

    async handleRequest(req: Party.Request): Promise<Response> {
        console.log("Handling lobby request:", {
            method: req.method,
            url: req.url,
        });

        try {
            const rooms = this.getAvailableRooms();
            console.log("Available rooms:", rooms);

            const response = {
                type: "roomsUpdate",
                rooms,
            };

            return new Response(JSON.stringify(response), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        } catch (error) {
            console.error("Error in handleRequest:", error);
            return new Response(JSON.stringify({ error: "Internal Server Error", details: (error as Error).message }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }
    }

    async onConnect(conn: Party.Connection) {
        console.log("New lobby connection:", conn.id);
        const rooms = this.getAvailableRooms();
        console.log("Sending rooms to new connection:", rooms);

        conn.send(
            JSON.stringify({
                type: "roomsUpdate",
                rooms,
            })
        );
    }

    private getAvailableRooms(): Game[] {
        const allGames = Array.from(games.values());
        console.log("All games:", allGames);

        return allGames.filter((game: Game) => !game.started).sort((a: Game, b: Game) => b.createdAt - a.createdAt);
    }
}
