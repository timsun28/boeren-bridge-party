import type * as Party from "partykit/server";
import type { Game, Player, Round } from "@/types/game";
import { calculateScore, generateTricksArray } from "./utils/game";

export const games = new Map<string, Game>();

export default class GameServer implements Party.Server {
    private game?: Game;

    constructor(private room: Party.Room) {
        console.log("[Game] Server initialized", {
            roomId: room.id,
            env: process.env.PARTYKIT_ENV,
        });
    }

    async onStart() {
        console.log("[Game] Server starting", { roomId: this.room.id });
        await this.loadGame();
        console.log("[Game] Server started", {
            roomId: this.room.id,
            gameLoaded: !!this.game,
            gameDetails: this.game
                ? {
                      id: this.game.id,
                      name: this.game.name,
                      players: this.game.players.length,
                      started: this.game.started,
                  }
                : undefined,
        });
    }

    async loadGame() {
        console.log("[Game] Loading game from storage", { roomId: this.room.id });
        try {
            this.game = await this.room.storage.get<Game>(this.room.id);
            console.log("[Game] Game loaded", {
                roomId: this.room.id,
                gameFound: !!this.game,
                gameDetails: this.game
                    ? {
                          id: this.game.id,
                          name: this.game.name,
                          players: this.game.players.length,
                      }
                    : undefined,
            });

            if (this.game) {
                games.set(this.game.id, this.game);
            }
        } catch (error) {
            console.error("[Game] Error loading game", {
                roomId: this.room.id,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    async saveGame(game: Game) {
        console.log("[Game] Saving game", {
            roomId: this.room.id,
            gameId: game.id,
            players: game.players.length,
            started: game.started,
        });

        try {
            await this.room.storage.put(game.id, game);
            games.set(game.id, game);
            console.log("[Game] Game saved successfully");

            if (!game.started) {
                this.broadcastRoomUpdate();
            }
        } catch (error) {
            console.error("[Game] Error saving game", {
                roomId: this.room.id,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    private broadcastRoomUpdate() {
        // Use broadcast to all connections instead of trying to access lobby
        this.room.broadcast(
            JSON.stringify({
                type: "roomsUpdate",
                rooms: Array.from(games.values()).filter((g) => !g.started),
            })
        );
    }

    async handleRequest(req: Party.Request): Promise<Response> {
        console.log("[Game] Handling request", {
            method: req.method,
            url: req.url,
            headers: Object.fromEntries(req.headers.entries()),
            gameId: this.room.id,
        });

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // Handle room creation
        if (req.method === "POST") {
            try {
                const body = (await req.json()) as { maxRounds?: number } & Partial<Game>;
                const game: Game = {
                    ...(body as Game),
                    createdAt: Date.now(),
                    players: [],
                    currentRound: 1,
                    rounds: [],
                    roundConfirmations: {},
                    status: "predicting",
                    started: false,
                    totalRounds: body.maxRounds || 7,
                    tricksPerRound: generateTricksArray(body.maxRounds || 7),
                    currentTricks: 1,
                    predictedTricksSum: 0,
                };

                await this.saveGame(game);
                this.broadcastRoomUpdate();

                return new Response(JSON.stringify(game), {
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders,
                    },
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to create room" }), {
                    status: 500,
                    headers: { "Content-Type": "application/json", ...corsHeaders },
                });
            }
        }

        // Get specific room
        if (req.method === "GET" && this.game) {
            console.log("[Game] Sending game state", {
                gameId: this.game.id,
                players: this.game.players.length,
            });
            return new Response(JSON.stringify(this.game), {
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                },
            });
        }

        console.log("[Game] Game not found or invalid method", {
            method: req.method,
            gameFound: !!this.game,
        });
        return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    onConnect(conn: Party.Connection) {
        if (!this.game) {
            console.log("No game found for room:", this.room.id);
            return;
        }

        conn.send(
            JSON.stringify({
                type: "gameState",
                game: this.game,
                connectionId: conn.id,
            })
        );
    }

    async handleMessage(message: string, sender: Party.Connection) {
        if (!this.game) return;

        const data = JSON.parse(message);
        const game = this.game;

        switch (data.type) {
            case "leaveGame": {
                game.players = game.players.filter((p) => p.id !== data.playerId);
                if (game.roundConfirmations[game.currentRound]) {
                    game.roundConfirmations[game.currentRound] = game.roundConfirmations[game.currentRound].filter(
                        (id) => id !== data.playerId
                    );
                }
                break;
            }

            case "joinGame": {
                if (game.started) {
                    sender.send(
                        JSON.stringify({
                            type: "error",
                            message: "Game has already started",
                        })
                    );
                    return;
                }

                const existingPlayer = game.players.find((p) => p.name === data.playerName);
                if (existingPlayer) {
                    existingPlayer.id = sender.id;
                } else {
                    const newPlayer: Player = {
                        id: sender.id,
                        name: data.playerName,
                        score: 0,
                        joinedAt: Date.now(),
                    };
                    game.players = [...game.players, newPlayer];
                }
                break;
            }

            // ... rest of your game logic cases (startGame, predictTricks, etc.)
        }

        await this.saveGame(game);
        this.room.broadcast(JSON.stringify({ type: "gameState", game }));
    }
}
