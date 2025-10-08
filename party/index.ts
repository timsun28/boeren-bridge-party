//@ts-nocheck
import type * as Party from "partykit/server";
import type { Game } from "@/types/game";
import { generateTricksArray } from "@/party/utils/game";

const VERSION = "v1.0.13";
export const SINGLETON_ROOM_ID = "lobby";
const GAMES_PREFIX = "game_";

// Store games in memory
const games = new Map<string, Game>();

export default class GameServer implements Party.Server {
    private game?: Game;
    private storage: Party.Storage;

    constructor(readonly room: Party.Room) {
        // Use the same storage instance for all rooms
        this.storage = room.storage;
        console.log("[Server] Constructor called:", {
            version: VERSION,
            roomId: room.id,
            isLobby: room.id === SINGLETON_ROOM_ID,
        });
    }

    async onStart() {
        // For lobby, load all games
        if (this.room.id === SINGLETON_ROOM_ID) {
            const storedGames = await this.room.storage.list();
            games.clear();
            for (const [key, game] of storedGames) {
                games.set(key, game as Game);
            }
            console.log("[Lobby] Loaded games:", {
                count: games.size,
                games: Array.from(games.values()),
            });
        } else {
            // For game rooms, load specific game
            await this.loadGameFromStorage("onStart");
        }
    }

    async onRequest(req: Party.Request) {
        console.log("[Server] onRequest:", {
            method: req.method,
            url: req.url,
            headers: Object.fromEntries(req.headers.entries()),
            roomId: this.room.id,
            isLobby: this.room.id === SINGLETON_ROOM_ID,
        });

        if (this.room.id !== SINGLETON_ROOM_ID) {
            await this.loadGameFromStorage("onRequest");
        }

        if (this.room.id === SINGLETON_ROOM_ID) {
            if (req.method === "GET") {
                return new Response(
                    JSON.stringify({
                        rooms: Array.from(games.values()),
                    }),
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
            }

            if (req.method === "POST") {
                const data = await req.json();
                console.log("[Lobby] Handling POST:", { data });

                if (data.type === "createGame") {
                    const gameId = crypto.randomUUID();
                    const game: Game = {
                        id: gameId,
                        name: data.name,
                        players: [],
                        started: false,
                        createdAt: Date.now(),
                        currentRound: 1,
                        rounds: [],
                        roundConfirmations: {},
                        status: "predicting",
                        currentTricks: 0,
                        predictedTricksSum: 0,
                        totalRounds: 7,
                        tricksPerRound: generateTricksArray(7),
                    };

                    // Save game and update in-memory state
                    await this.room.storage.put(gameId, game);
                    try {
                        const gameRoom = this.room.context.parties.main.get(gameId);
                        await gameRoom.storage.put(gameId, game);
                        console.log("[Lobby] Seeded game room storage:", { gameId });
                    } catch (error) {
                        console.error("[Lobby] Failed to seed game room storage:", {
                            gameId,
                            error,
                        });
                    }
                    games.set(gameId, game);

                    // Broadcast update to all lobby connections
                    this.broadcastGameList();

                    return new Response(JSON.stringify(game), {
                        headers: {
                            "Content-Type": "application/json",
                        },
                    });
                }
            }
        }

        // Game room requests
        if (this.game) {
            return new Response(
                JSON.stringify({
                    game: this.game,
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        console.log("[Game] Game not found:", this.room.id);
        return new Response("Not found", { status: 404 });
    }

    async onConnect(conn: Party.Connection) {
        console.log("[Server] onConnect:", {
            connectionId: conn.id,
            roomId: this.room.id,
            isLobby: this.room.id === SINGLETON_ROOM_ID,
        });

        if (this.room.id !== SINGLETON_ROOM_ID) {
            await this.loadGameFromStorage("onConnect");
        }

        if (this.room.id === SINGLETON_ROOM_ID) {
            console.log("[Lobby] Broadcasting game list to new connection");
            this.broadcastGameList();
            return;
        }

        if (this.game) {
            console.log("[Game] Sending game state to new connection:", {
                gameId: this.game.id,
                connectionId: conn.id,
            });
            conn.send(JSON.stringify({ type: "gameState", game: this.game }));
        } else {
            console.warn("[Game] Connection established but game not loaded:", {
                roomId: this.room.id,
                connectionId: conn.id,
            });
        }
    }

    async onMessage(message: string, sender: Party.Connection) {
        console.log("[Server] onMessage:", {
            message,
            senderId: sender.id,
            roomId: this.room.id,
        });

        if (this.room.id !== SINGLETON_ROOM_ID) {
            await this.loadGameFromStorage("onMessage");
        }

        if (!this.game) {
            console.warn("[Game] Ignoring message because game not loaded:", {
                roomId: this.room.id,
                senderId: sender.id,
            });
            return;
        }

        let data: { type: string; [key: string]: unknown };
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error("[Server] Failed to parse incoming message:", {
                error,
                rawMessage: message,
                roomId: this.room.id,
                senderId: sender.id,
            });
            sender.send(
                JSON.stringify({
                    type: "error",
                    message: "Invalid message format",
                })
            );
            return;
        }

        console.log("[Server] Message:", { type: data.type, sender: sender.id });

        if (this.room.id !== SINGLETON_ROOM_ID && this.game) {
            switch (data.type) {
                case "joinGame": {
                    console.log("[Game] Processing join request:", {
                        gameId: this.game.id,
                        playerId: sender.id,
                        playerName: data.playerName,
                    });

                    if (!this.game.players.find((p) => p.id === sender.id)) {
                        this.game.players.push({
                            id: sender.id,
                            name: data.playerName,
                            score: 0,
                            joinedAt: Date.now(),
                        });
                        console.log("[Game] Player added:", {
                            gameId: this.game.id,
                            players: this.game.players,
                        });
                        this.saveAndBroadcastGame();
                    } else {
                        console.log("[Game] Player already in game:", {
                            playerId: sender.id,
                            gameId: this.game.id,
                        });
                    }
                    break;
                }
                default: {
                    console.log("[Game] Received unsupported message type:", {
                        type: data.type,
                        roomId: this.room.id,
                        senderId: sender.id,
                    });
                }
            }
        }
    }

    private async loadGameFromStorage(context: string) {
        if (this.game) {
            return;
        }

        try {
            const storedGame = await this.storage.get<Game>(this.room.id);
            if (storedGame) {
                this.game = storedGame;
                console.log("[Game] Loaded from storage:", {
                    context,
                    roomId: this.room.id,
                    players: storedGame.players?.length ?? 0,
                });
                return;
            }

            console.warn("[Game] Storage returned nothing:", {
                context,
                roomId: this.room.id,
            });

            if (games.has(this.room.id)) {
                this.game = games.get(this.room.id);
                console.log("[Game] Fallback to in-memory cache:", {
                    context,
                    roomId: this.room.id,
                });
            }
        } catch (error) {
            console.error("[Game] Failed to load from storage:", {
                context,
                roomId: this.room.id,
                error,
            });
        }
    }

    private broadcastGameList() {
        console.log("[Lobby] Broadcasting game list:", {
            gamesCount: games.size,
            games: Array.from(games.values()),
        });

        this.room.broadcast(
            JSON.stringify({
                type: "roomsUpdate",
                rooms: Array.from(games.values()),
            })
        );
    }

    private async saveAndBroadcastGame() {
        if (!this.game) {
            console.error("[Game] Cannot save/broadcast: no game loaded");
            return;
        }

        console.log("[Game] Saving game state:", {
            gameId: this.game.id,
            players: this.game.players,
        });

        try {
            await this.storage.put(this.room.id, this.game);
            console.log("[Game] Game saved to storage with key:", this.room.id);

            games.set(this.room.id, this.game);
            console.log("[Game] Game updated in memory");

            this.room.broadcast(
                JSON.stringify({
                    type: "gameState",
                    game: this.game,
                })
            );
            console.log("[Game] Game state broadcasted to room");

            try {
                const lobbyRoom = this.room.context.parties.main.get(SINGLETON_ROOM_ID);
                await lobbyRoom.fetch("/", {
                    method: "GET",
                });
                console.log("[Game] Lobby notified of update");
            } catch (error) {
                console.error("[Game] Failed to notify lobby:", error);
            }
        } catch (error) {
            console.error("[Game] Save and broadcast failed:", {
                error,
                gameId: this.game.id,
            });
        }
    }

    private async saveGame(game: Game) {
        const key = `${GAMES_PREFIX}${game.id}`;
        console.log("[Server] Saving game:", { key, game });

        try {
            // Save to shared storage
            await this.storage.put(key, game);
            games.set(game.id, game);
            console.log("[Server] Game saved successfully:", { key });

            // Broadcast updates
            if (this.room.id === SINGLETON_ROOM_ID) {
                this.broadcastGameList();
            } else {
                this.room.broadcast(JSON.stringify({ type: "gameState", game }));
                this.broadcastGameList(); // Also update lobby
            }
        } catch (error) {
            console.error("[Server] Failed to save game:", { error, key });
        }
    }
}

GameServer satisfies Party.Worker;
