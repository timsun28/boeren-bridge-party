import type * as Party from "partykit/server";
import type { Game, Player, Round } from "@/types/game";
import { generateTricksArray } from "@/types/game";

const IS_PRODUCTION = process.env.PARTYKIT_ENV === "production";

export default class Server implements Party.Server {
    constructor(readonly room: Party.Room) {}

    game: Game | undefined;
    static games: Map<string, Game> = new Map();

    // Update onStart to properly load games
    async onStart() {
        console.log("Starting server for room:", this.room.id);
        if (this.room.id === "lobby") {
            await this.loadGames();
            return;
        }

        // For game rooms, load their specific game
        const game = await this.room.storage.get<Game>(this.room.id);
        if (game) {
            this.game = game;
            Server.games.set(game.id, game);
            console.log("Loaded game:", game.id);
        }
    }

    // Update saveGame method to use individual keys
    async saveGame(game: Game) {
        // Save game under its own ID
        await this.room.storage.put(game.id, game);
        Server.games.set(game.id, game);
        console.log("Saved game:", game.id);
    }

    calculateScore(predicted: number, actual: number): number {
        if (predicted === actual) {
            return 10 + actual;
        }
        return -Math.abs(predicted - actual);
    }

    // Helper function to get available rooms
    private getAvailableRooms() {
        console.log("Getting available rooms, all games:", Array.from(Server.games.entries()));
        const rooms = Array.from(Server.games.values())
            .filter((g) => !g.started)
            .sort((a, b) => b.createdAt - a.createdAt);
        console.log("Filtered available rooms:", rooms);
        return rooms;
    }

    async onConnect(conn: Party.Connection) {
        console.log("New connection:", conn.id, "to room:", this.room.id);

        if (this.room.id === "lobby") {
            // Send current rooms list to new lobby connection
            conn.send(
                JSON.stringify({
                    type: "roomsUpdate",
                    rooms: this.getAvailableRooms(),
                })
            );
            return;
        }

        // Handle game room connection
        const game = Server.games.get(this.room.id);
        if (!game) {
            console.log("No game found for room:", this.room.id);
            return;
        }

        console.log("Current players:", game.players);
        conn.send(
            JSON.stringify({
                type: "gameState",
                game,
                connectionId: conn.id,
            })
        );
    }

    async onMessage(message: string, sender: Party.Connection) {
        console.log("Received message:", {
            type: JSON.parse(message).type,
            sender: sender.id,
            roomId: this.room.id,
        });

        const game = Server.games.get(this.room.id);
        if (!game) return;

        const data = JSON.parse(message);

        switch (data.type) {
            case "leaveGame": {
                console.log("Player leaving game:", {
                    playerId: data.playerId,
                    roomId: this.room.id,
                });
                game.players = game.players.filter((p) => p.id !== data.playerId);
                if (game.roundConfirmations[game.currentRound]) {
                    game.roundConfirmations[game.currentRound] = game.roundConfirmations[game.currentRound].filter(
                        (id) => id !== data.playerId
                    );
                }
                await this.saveGame(game);
                this.room.broadcast(JSON.stringify({ type: "gameState", game }));
                break;
            }
            case "joinGame": {
                console.log("Player joining game:", {
                    playerName: data.playerName,
                    roomId: this.room.id,
                });
                // Prevent joining if game has started
                if (game.started) {
                    sender.send(
                        JSON.stringify({
                            type: "error",
                            message: "Game has already started",
                        })
                    );
                    return;
                }

                // Check if player already exists
                const existingPlayer = game.players.find((p) => p.name === data.playerName);
                if (existingPlayer) {
                    // Update existing player's connection ID
                    existingPlayer.id = sender.id;
                } else {
                    // Add new player
                    const newPlayer: Player = {
                        id: sender.id,
                        name: data.playerName,
                        score: 0,
                        joinedAt: Date.now(),
                    };
                    game.players = [...game.players, newPlayer];
                }
                await this.saveGame(game);

                // Broadcast updated game state to all connections
                this.room.broadcast(JSON.stringify({ type: "gameState", game }));
                break;
            }

            case "startGame": {
                console.log("Starting game:", {
                    roomId: this.room.id,
                    playerCount: game.players.length,
                });
                if (game.players.length >= 2) {
                    game.started = true;
                    await this.saveGame(game);
                    this.room.broadcast(JSON.stringify({ type: "gameState", game }));
                }
                break;
            }

            case "predictTricks": {
                const player = game.players.find((p) => p.id === data.playerId);
                if (player && game.status === "predicting") {
                    player.predictedTricks = data.tricks;

                    // Check if all players have predicted
                    const allPredicted = game.players.every((p) => p.predictedTricks !== undefined);
                    if (allPredicted) {
                        game.status = "playing";
                    }
                }
                break;
            }

            case "submitTricks": {
                const player = game.players.find((p) => p.id === data.playerId);
                if (player && game.status === "playing") {
                    player.actualTricks = data.actual;

                    // Check if all players have submitted actual tricks
                    const allSubmitted = game.players.every((p) => p.actualTricks !== undefined);
                    if (allSubmitted) {
                        game.status = "confirming";

                        // Create or update round
                        const round: Round = {
                            roundNumber: game.currentRound,
                            predictions: {},
                            actual: {},
                            scores: {},
                            completed: false,
                        };

                        game.players.forEach((p) => {
                            round.predictions[p.id] = p.predictedTricks!;
                            round.actual[p.id] = p.actualTricks!;
                            round.scores[p.id] = this.calculateScore(p.predictedTricks!, p.actualTricks!);
                        });

                        const existingRoundIndex = game.rounds.findIndex((r) => r.roundNumber === game.currentRound);
                        if (existingRoundIndex >= 0) {
                            game.rounds[existingRoundIndex] = round;
                        } else {
                            game.rounds.push(round);
                        }

                        game.roundConfirmations[game.currentRound] = [];
                    }

                    await this.saveGame(game);
                    this.room.broadcast(JSON.stringify({ type: "gameState", game }));
                }
                break;
            }

            case "confirmRound": {
                if (game.status === "confirming") {
                    const confirmations = game.roundConfirmations[game.currentRound] || [];
                    if (!confirmations.includes(data.playerId)) {
                        game.roundConfirmations[game.currentRound] = [...confirmations, data.playerId];
                        await this.saveGame(game);
                    }

                    if (game.roundConfirmations[game.currentRound].length === game.players.length) {
                        const round = game.rounds.find((r) => r.roundNumber === game.currentRound);
                        if (round) {
                            round.completed = true;

                            game.players.forEach((player) => {
                                player.score += round.scores[player.id];
                                player.predictedTricks = undefined;
                                player.actualTricks = undefined;
                            });

                            game.currentRound += 1;
                            // Update current tricks based on the round index
                            game.currentTricks = game.tricksPerRound[game.currentRound - 1];
                            game.predictedTricksSum = 0; // Reset sum for new round
                            game.status = "predicting";

                            // Check if game is complete
                            if (game.currentRound > game.tricksPerRound.length) {
                                game.status = "completed";
                            }

                            await this.saveGame(game);
                        }
                    }
                }
                break;
            }

            case "editRound": {
                const round = game.rounds.find((r) => r.roundNumber === data.roundNumber);
                if (round && !round.completed) {
                    game.currentRound = data.roundNumber;
                    game.status = "predicting";
                    delete game.roundConfirmations[data.roundNumber];

                    game.players.forEach((player) => {
                        if (round.scores[player.id]) {
                            player.score -= round.scores[player.id];
                        }
                        player.predictedTricks = undefined;
                        player.actualTricks = undefined;
                    });

                    await this.saveGame(game);
                }
                break;
            }

            case "updatePrediction": {
                const player = game.players.find((p) => p.id === data.playerId);
                if (player && game.status === "predicting") {
                    player.tempPrediction = data.tricks;
                    this.room.broadcast(JSON.stringify({ type: "gameState", game }));
                }
                break;
            }

            case "confirmPrediction": {
                const player = game.players.find((p) => p.id === data.playerId);
                if (player && game.status === "predicting") {
                    const isLastPlayer = game.players.filter((p) => p.predictedTricks === undefined).length === 1;
                    if (isLastPlayer) {
                        // Check if this prediction would make sum equal to total tricks
                        const sum = game.predictedTricksSum + data.tricks;
                        if (sum === game.currentTricks) {
                            sender.send(
                                JSON.stringify({
                                    type: "error",
                                    message: "Your prediction would make the total equal to available tricks",
                                })
                            );
                            return;
                        }
                    }

                    player.predictedTricks = data.tricks;
                    game.predictedTricksSum += data.tricks;
                    delete player.tempPrediction;

                    // Check if all players have predicted
                    const unpredictedPlayers = game.players.filter((p) => p.predictedTricks === undefined);
                    if (unpredictedPlayers.length === 0) {
                        game.status = "playing";
                    }

                    await this.saveGame(game);
                    this.room.broadcast(JSON.stringify({ type: "gameState", game }));
                }
                break;
            }
        }

        // Broadcast updated game state to all connections
        this.room.broadcast(JSON.stringify({ type: "gameState", game }));
    }

    async onRequest(req: Party.Request) {
        console.log("Handling request:", {
            method: req.method,
            url: req.url,
            roomId: this.room.id,
        });

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (req.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        if (this.room.id === "lobby") {
            console.log("LOBBY: Handling lobby request");
            // Ensure games are loaded
            await this.loadGames();
            const rooms = this.getAvailableRooms();

            // Broadcast to all lobby connections
            this.room.broadcast(
                JSON.stringify({
                    type: "roomsUpdate",
                    rooms,
                })
            );

            return new Response(
                JSON.stringify({
                    type: "roomsUpdate",
                    rooms,
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders,
                    },
                }
            );
        }

        // Handle room creation
        if (req.method === "POST") {
            console.log("POST: Creating new game room in env:", {
                partyKitEnv: process.env.PARTYKIT_ENV,
                isProduction: IS_PRODUCTION,
                url: req.url,
            });

            try {
                const body = (await req.json()) as { maxRounds?: number } & Partial<Game>;
                console.log("POST: Received game data:", body);
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
                console.log("POST: Storage after save:", {
                    gameId: game.id,
                    storageKeys: Array.from((await this.room.storage.list()).entries()),
                    partyKitEnv: process.env.PARTYKIT_ENV,
                    url: req.url,
                });

                // Broadcast to all rooms
                this.room.broadcast(
                    JSON.stringify({
                        type: "roomsUpdate",
                        rooms: this.getAvailableRooms(),
                    })
                );

                return new Response(JSON.stringify(game), {
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders,
                    },
                });
            } catch (error) {
                console.error("POST: Error in room creation:", error);
                return new Response(JSON.stringify({ error: "Failed to create room", details: error }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                });
            }
        }

        // Get specific room
        if (req.method === "GET") {
            const game = Server.games.get(this.room.id);
            return new Response(JSON.stringify(game), {
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                },
            });
        }

        // Return 404 for any unhandled requests
        return new Response("Not found", {
            status: 404,
            headers: corsHeaders,
        });
    }

    // Update loadGames method to use list()
    private async loadGames() {
        console.log("Loading games from storage");
        try {
            const items = await this.room.storage.list();
            console.log("Storage items:", Array.from(items.entries()));

            for (const [key, value] of items) {
                const game = value as Game;
                if (!game.started) {
                    Server.games.set(game.id, game);
                }
            }
        } catch (error) {
            console.error("Error loading games:", error);
        }
    }
}

Server satisfies Party.Worker;
