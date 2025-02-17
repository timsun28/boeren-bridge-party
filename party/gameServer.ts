import type * as Party from "partykit/server";
import type { Game, Player, Round } from "@/types/game";
import { generateTricksArray } from "@/party/utils/game";

// Make games Map persistent across server restarts
const GAMES_KEY = "games";
const GAME_VERSION = "v1.0.12"; // Add version indicator
export const games = new Map<string, Game>();

const GAMES_PREFIX = "games/";

const LOBBY_ROOM = "lobby";

export default class GameServer implements Party.Server {
    private game?: Game;

    constructor(private room: Party.Room) {
        console.log("[Game] Server initialized", {
            version: GAME_VERSION,
            roomId: room.id,
            env: process.env.PARTYKIT_ENV,
        });
    }

    async onStart() {
        console.log("[Game] Server starting", {
            version: GAME_VERSION,
            roomId: this.room.id,
        });
        await this.loadGame();
        console.log("[Game] Server started", {
            version: GAME_VERSION,
            roomId: this.room.id,
            gameLoaded: !!this.game,
        });
    }

    async loadGame() {
        console.log("[Game] Loading game from storage", {
            version: GAME_VERSION,
            roomId: this.room.id,
        });
        try {
            this.game = await this.room.storage.get<Game>(this.room.id);
            console.log("[Game] Game loaded", {
                version: GAME_VERSION,
                roomId: this.room.id,
                gameFound: !!this.game,
            });

            if (this.game) {
                await this.room.storage.put(`${GAMES_PREFIX}${this.room.id}`, this.game);
                games.set(this.game.id, this.game);
            }
        } catch (error) {
            console.error("[Game] Error loading game", {
                version: GAME_VERSION,
                error: error instanceof Error ? error.message : error,
            });
        }
    }

    async saveGame(game: Game) {
        console.log("[Game] Saving game", {
            version: GAME_VERSION,
            roomId: this.room.id,
            gameId: game.id,
        });

        try {
            // Save to this room's storage
            await this.room.storage.put(this.room.id, game);
            games.set(game.id, game);

            // Send to lobby using party fetch
            const response = await this.room.context.parties.lobby.get("lobby").fetch("/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "updateGame",
                    game: {
                        ...game,
                        id: game.id.replace(GAMES_PREFIX, ""),
                    },
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Lobby update failed (${response.status}): ${text}`);
            }

            const result = await response.json();
            console.log("[Game] Game saved successfully", {
                version: GAME_VERSION,
                gameId: game.id,
                lobbyResponse: result,
            });

            if (!game.started) {
                this.broadcastRoomUpdate();
            }
        } catch (error) {
            console.error("[Game] Error saving game", {
                version: GAME_VERSION,
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

    async onRequest(req: Party.Request): Promise<Response> {
        console.log("[Game] Handling request", {
            version: GAME_VERSION,
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
                version: GAME_VERSION,
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
            version: GAME_VERSION,
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
