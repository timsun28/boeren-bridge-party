import type * as Party from "partykit/server";
import type { Game, Round } from "@/types/game";
import { DEFAULT_MAX_ROUNDS, SINGLETON_ROOM_ID } from "@/party/constants";
import { calculateScore, generateTricksArray } from "@/party/utils/game";

const VERSION = "v1.2.0";
const MIN_PLAYERS = 2;

const games = new Map<string, Game>();

const deriveCurrentTricks = (game: Game) => game.tricksPerRound[game.currentRound - 1] ?? 0;

const normalizeGame = (game: Game): Game => {
    const maxRounds = game.totalRounds || DEFAULT_MAX_ROUNDS;
    const tricksPerRound = game.tricksPerRound?.length ? game.tricksPerRound : generateTricksArray(maxRounds);
    const normalized: Game = {
        ...game,
        tricksPerRound,
        currentRound: game.currentRound || 1,
        currentTricks: game.currentTricks || deriveCurrentTricks(game),
        roundConfirmations: game.roundConfirmations || {},
        rounds: game.rounds || [],
        players: game.players || [],
        predictedTricksSum: game.predictedTricksSum || 0,
        status: game.status || "predicting",
    };

    normalized.predictedTricksSum = normalized.players.reduce((sum, player) => sum + (player.predictedTricks ?? 0), 0);
    return normalized;
};

const recalcScoresFromRounds = (game: Game) => {
    for (const player of game.players) {
        player.score = 0;
    }

    for (const round of game.rounds) {
        for (const player of game.players) {
            player.score += round.scores[player.id] ?? 0;
        }
    }
};

const resetPlayersForNextRound = (game: Game) => {
    for (const player of game.players) {
        player.predictedTricks = undefined;
        player.actualTricks = undefined;
        player.tempPrediction = undefined;
    }
    game.predictedTricksSum = 0;
    game.currentTricks = deriveCurrentTricks(game);
};

const removePlayerFromRounds = (game: Game, playerId: string) => {
    for (const round of game.rounds) {
        delete round.predictions[playerId];
        delete round.actual[playerId];
        delete round.scores[playerId];
    }
};

export default class GameServer implements Party.Server {
    options: Party.ServerOptions = {
        hibernate: true,
    };

    private game?: Game;
    private storage: Party.Storage;

    constructor(readonly room: Party.Room) {
        this.storage = room.storage;
        console.log("[Server] Constructor", {
            version: VERSION,
            roomId: room.id,
            isLobby: room.id === SINGLETON_ROOM_ID,
        });
    }

    async onStart() {
        if (this.room.id === SINGLETON_ROOM_ID) {
            await this.loadLobbyGames();
        } else {
            await this.loadGameFromStorage("onStart");
        }
    }

    async onRequest(req: Party.Request) {
        console.log("[Server] onRequest", {
            method: req.method,
            url: req.url,
            roomId: this.room.id,
        });

        const isLobby = this.room.id === SINGLETON_ROOM_ID;
        const body = req.method === "POST" ? await req.json().catch(() => undefined) : undefined;

        if (!isLobby && body && typeof body === "object" && (body as { action?: string }).action === "seedGame") {
            const game = (body as { game?: Game }).game;
            if (game) {
                this.game = normalizeGame(game);
                games.set(this.room.id, this.game);
                await this.storage.put(this.room.id, this.game);
                console.log("[Game] Seeded room storage from lobby", { roomId: this.room.id });
                return this.buildJsonResponse({ ok: true });
            }
        }

        if (!isLobby) {
            await this.loadGameFromStorage("onRequest");
        }

        if (isLobby && req.method === "GET") {
            return this.buildJsonResponse({ rooms: Array.from(games.values()) });
        }

        if (isLobby && body && typeof body === "object" && (body as { action?: string }).action === "syncGame") {
            const game = (body as { game?: Game }).game;
            if (game) {
                const normalized = normalizeGame(game);
                games.set(normalized.id, normalized);
                await this.storage.put(normalized.id, normalized);
                this.broadcastGameList();
                return this.buildJsonResponse({ ok: true });
            }
        }

        if (isLobby && body && typeof body === "object" && (body as { action?: string }).action === "deleteGame") {
            const gameId = (body as { gameId?: unknown }).gameId;
            if (typeof gameId === "string") {
                games.delete(gameId);
                await this.storage.delete(gameId);
                this.broadcastGameList();
                return this.buildJsonResponse({ ok: true });
            }
        }

        if (isLobby && req.method === "POST") {
            return this.handleCreateGame(body);
        }

        if (this.game) {
            return this.buildJsonResponse({ game: this.game });
        }

        return new Response("Not found", { status: 404 });
    }

    async onConnect(conn: Party.Connection) {
        console.log("[Server] onConnect", {
            connectionId: conn.id,
            roomId: this.room.id,
        });

        if (this.room.id !== SINGLETON_ROOM_ID) {
            await this.loadGameFromStorage("onConnect");
        }

        if (this.room.id === SINGLETON_ROOM_ID) {
            this.broadcastGameList();
            return;
        }

        if (this.game) {
            conn.send(JSON.stringify({ type: "gameState", game: this.game }));
        } else {
            conn.send(
                JSON.stringify({
                    type: "error",
                    message: "Game not found",
                })
            );
            conn.close();
        }
    }

    async onMessage(message: string, sender: Party.Connection) {
        console.log("[Server] onMessage", {
            roomId: this.room.id,
            senderId: sender.id,
            message,
        });

        if (this.room.id !== SINGLETON_ROOM_ID) {
            await this.loadGameFromStorage("onMessage");
        }

        if (!this.game) {
            sender.send(
                JSON.stringify({
                    type: "error",
                    message: "Game not ready",
                })
            );
            return;
        }

        let data: { type?: string; [key: string]: unknown };
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error("[Server] Failed to parse message", { error });
            sender.send(
                JSON.stringify({
                    type: "error",
                    message: "Invalid message format",
                })
            );
            return;
        }

        switch (data.type) {
            case "joinGame":
                await this.handleJoinGame(sender, data.playerName);
                break;
            case "leaveGame":
                await this.handleLeaveGame(data.playerId);
                break;
            case "startGame":
                await this.handleStartGame();
                break;
            case "updatePrediction":
                await this.handleUpdatePrediction(data.playerId, data.tricks);
                break;
            case "confirmPrediction":
                await this.handleConfirmPrediction(data.playerId, data.tricks);
                break;
            case "submitTricks":
                await this.handleSubmitTricks(data.playerId, data.predicted, data.actual);
                break;
            case "confirmRound":
                await this.handleConfirmRound(data.playerId);
                break;
            case "editRound":
                await this.handleEditRound(data.roundNumber);
                break;
            default:
                console.warn("[Server] Unsupported message type", { type: data.type });
        }
    }

    private async handleCreateGame(data: unknown) {
        try {
            const name = typeof (data as { name?: unknown })?.name === "string" ? (data as { name: string }).name.trim() : "";
            if (!name) {
                return this.buildJsonResponse({ error: "Name is required" }, 400);
            }

            const gameId = crypto.randomUUID();
            const tricksPerRound = generateTricksArray(DEFAULT_MAX_ROUNDS);
            const game: Game = {
                id: gameId,
                name,
                players: [],
                started: false,
                createdAt: Date.now(),
                currentRound: 1,
                rounds: [],
                roundConfirmations: {},
                status: "predicting",
                currentTricks: tricksPerRound[0],
                predictedTricksSum: 0,
                totalRounds: DEFAULT_MAX_ROUNDS,
                tricksPerRound,
            };

            games.set(gameId, game);
            await this.persistGame(game);
            this.broadcastGameList();

            return this.buildJsonResponse(game, 200);
        } catch (error) {
            console.error("[Lobby] Failed to create game", { error });
            return this.buildJsonResponse({ error: "Failed to create game" }, 500);
        }
    }

    private async handleJoinGame(sender: Party.Connection, playerName: unknown) {
        if (!this.game) {
            return;
        }

        const trimmedName = typeof playerName === "string" ? playerName.trim() : "";
        if (!trimmedName) {
            sender.send(
                JSON.stringify({
                    type: "error",
                    message: "Player name required",
                })
            );
            return;
        }

        const existingPlayer = this.game.players.find((player) => player.id === sender.id);
        if (existingPlayer) {
            existingPlayer.name = trimmedName;
            console.log("[Game] Player rejoined", { playerId: sender.id, roomId: this.room.id });
        } else {
            this.game.players.push({
                id: sender.id,
                name: trimmedName,
                score: 0,
                joinedAt: Date.now(),
            });
            console.log("[Game] Player added", { playerId: sender.id, roomId: this.room.id });
        }

        recalcScoresFromRounds(this.game);
        await this.saveAndBroadcastGame("joinGame");
    }

    private async handleLeaveGame(playerId: unknown) {
        if (!this.game || typeof playerId !== "string") {
            return;
        }

        this.game.players = this.game.players.filter((player) => player.id !== playerId);
        removePlayerFromRounds(this.game, playerId);

        for (const key of Object.keys(this.game.roundConfirmations)) {
            this.game.roundConfirmations[Number(key)] = this.game.roundConfirmations[Number(key)].filter(
                (id) => id !== playerId
            );
        }

        if (this.game.players.length === 0) {
            await this.deleteGame();
            return;
        }

        recalcScoresFromRounds(this.game);
        this.game.predictedTricksSum = this.game.players.reduce((sum, player) => sum + (player.predictedTricks ?? 0), 0);
        await this.saveAndBroadcastGame("leaveGame");
    }

    private async handleStartGame() {
        if (!this.game) {
            return;
        }

        if (this.game.players.length < MIN_PLAYERS) {
            console.warn("[Game] Not enough players to start", { count: this.game.players.length });
            return;
        }

        this.game.started = true;
        this.game.status = "predicting";
        this.game.currentRound = 1;
        this.game.currentTricks = deriveCurrentTricks(this.game);
        this.game.roundConfirmations = {};
        this.game.rounds = [];
        resetPlayersForNextRound(this.game);

        await this.saveAndBroadcastGame("startGame");
    }

    private async handleUpdatePrediction(playerId: unknown, tricks: unknown) {
        if (!this.game || typeof playerId !== "string" || typeof tricks !== "number") {
            return;
        }

        const player = this.game.players.find((p) => p.id === playerId);
        if (!player) {
            return;
        }

        // Store provisional choice without locking it in yet; confirmation will finalize.
        player.tempPrediction = tricks;
        this.game.predictedTricksSum = this.game.players.reduce((sum, current) => {
            const value = current.tempPrediction ?? current.predictedTricks ?? 0;
            return sum + value;
        }, 0);

        await this.saveAndBroadcastGame("updatePrediction");
    }

    private async handleConfirmPrediction(playerId: unknown, tricks: unknown) {
        if (!this.game || typeof playerId !== "string") {
            return;
        }

        const player = this.game.players.find((p) => p.id === playerId);
        if (!player) {
            return;
        }

        const finalTricks = typeof tricks === "number" ? tricks : player.tempPrediction;
        if (typeof finalTricks === "number") {
            player.predictedTricks = finalTricks;
        }
        player.tempPrediction = undefined;

        const everyoneReady = this.game.players.every((p) => typeof p.predictedTricks === "number");
        this.game.predictedTricksSum = this.game.players.reduce((sum, current) => {
            const value = current.tempPrediction ?? current.predictedTricks ?? 0;
            return sum + value;
        }, 0);

        if (everyoneReady) {
            this.game.status = "playing";
        }

        await this.saveAndBroadcastGame("confirmPrediction");
    }

    private async handleSubmitTricks(playerId: unknown, predicted: unknown, actual: unknown) {
        if (!this.game || typeof playerId !== "string" || typeof actual !== "number") {
            return;
        }

        const player = this.game.players.find((p) => p.id === playerId);
        if (!player) {
            return;
        }

        if (typeof predicted === "number") {
            player.predictedTricks = predicted;
        }
        player.actualTricks = actual;
        this.game.predictedTricksSum = this.game.players.reduce(
            (sum, current) => sum + (current.predictedTricks ?? 0),
            0
        );

        const everyoneSubmitted = this.game.players.every((p) => typeof p.actualTricks === "number");
        if (everyoneSubmitted) {
            this.finalizeRound();
        }

        await this.saveAndBroadcastGame("submitTricks");
    }

    private async handleConfirmRound(playerId: unknown) {
        if (!this.game || typeof playerId !== "string") {
            return;
        }

        const confirmations = this.game.roundConfirmations[this.game.currentRound] || [];
        if (!confirmations.includes(playerId)) {
            confirmations.push(playerId);
        }
        this.game.roundConfirmations[this.game.currentRound] = confirmations;

        if (confirmations.length >= this.game.players.length) {
            await this.progressToNextRound();
            return;
        }

        await this.saveAndBroadcastGame("confirmRound");
    }

    private async handleEditRound(roundNumber: unknown) {
        if (!this.game || typeof roundNumber !== "number") {
            return;
        }

        const targetRound = this.game.rounds.find((round) => round.roundNumber === roundNumber);
        if (!targetRound) {
            return;
        }

        this.game.rounds = this.game.rounds.filter((round) => round.roundNumber < roundNumber);
        for (const key of Object.keys(this.game.roundConfirmations)) {
            if (Number(key) >= roundNumber) {
                delete this.game.roundConfirmations[Number(key)];
            }
        }

        for (const player of this.game.players) {
            player.predictedTricks = targetRound.predictions[player.id];
            player.actualTricks = targetRound.actual[player.id];
        }

        this.game.currentRound = roundNumber;
        this.game.status = "playing";
        this.game.currentTricks = deriveCurrentTricks(this.game);
        recalcScoresFromRounds(this.game);
        await this.saveAndBroadcastGame("editRound");
    }

    private finalizeRound() {
        if (!this.game) {
            return;
        }

        const roundNumber = this.game.currentRound;
        const round: Round = {
            roundNumber,
            predictions: {},
            actual: {},
            scores: {},
            completed: false,
        };

        for (const player of this.game.players) {
            const predicted = player.predictedTricks ?? 0;
            const actual = player.actualTricks ?? 0;
            round.predictions[player.id] = predicted;
            round.actual[player.id] = actual;
            round.scores[player.id] = calculateScore(predicted, actual);
        }

        this.game.rounds = this.game.rounds.filter((existing) => existing.roundNumber !== roundNumber);
        this.game.rounds.push(round);
        this.game.rounds.sort((a, b) => a.roundNumber - b.roundNumber);

        this.game.roundConfirmations[roundNumber] = [];
        this.game.status = "confirming";
        recalcScoresFromRounds(this.game);
    }

    private async progressToNextRound() {
        if (!this.game) {
            return;
        }

        const round = this.game.rounds.find((entry) => entry.roundNumber === (this.game?.currentRound ?? 0));
        if (round) {
            round.completed = true;
        }

        const nextRound = this.game.currentRound + 1;
        const hasMoreRounds = nextRound <= this.game.tricksPerRound.length;

        if (!hasMoreRounds) {
            this.game.status = "completed";
            recalcScoresFromRounds(this.game);
            await this.saveAndBroadcastGame("completeGame");
            return;
        }

        this.game.currentRound = nextRound;
        this.game.status = "predicting";
        resetPlayersForNextRound(this.game);
        recalcScoresFromRounds(this.game);
        await this.saveAndBroadcastGame("nextRound");
    }

    private async loadLobbyGames() {
        const storedGames = await this.room.storage.list<Game>();
        games.clear();
        for (const [key, value] of storedGames) {
            const normalized = normalizeGame(value as Game);
            games.set(key, normalized);
        }
        console.log("[Lobby] Loaded games", { count: games.size });
    }

    private async loadGameFromStorage(context: string) {
        if (this.game) {
            return;
        }

        try {
            const storedGame = await this.storage.get<Game>(this.room.id);
            if (storedGame) {
                this.game = normalizeGame(storedGame);
                games.set(this.room.id, this.game);
                return;
            }

            const lobbyGame = await this.fetchGameFromLobby(this.room.id);
            if (lobbyGame) {
                this.game = normalizeGame(lobbyGame);
                games.set(this.room.id, this.game);
                await this.storage.put(this.room.id, this.game);
                return;
            }

            console.warn("[Game] Missing game in storage", { context, roomId: this.room.id });
        } catch (error) {
            console.error("[Game] Failed to load game", { context, error });
        }
    }

    private async fetchGameFromLobby(gameId: string) {
        try {
            const lobbyRoom = this.room.context.parties.main?.get(SINGLETON_ROOM_ID);
            if (!lobbyRoom) {
                console.warn("[Game] Lobby stub unavailable while fetching game", { gameId });
                return;
            }

            // PartyKit stubs expect a path beginning with "/"; using an absolute
            // placeholder URL triggers "Path must start with /" in recent releases.
            const response = await lobbyRoom.fetch("/", { method: "GET" });
            if (!response.ok) {
                console.warn("[Game] Failed to fetch lobby games", { status: response.status });
                return;
            }

            const data = (await response.json().catch(() => undefined)) as { rooms?: Game[] } | undefined;
            const lobbyGame = data?.rooms?.find((room) => room.id === gameId);
            return lobbyGame;
        } catch (error) {
            console.error("[Game] Failed to fetch game from lobby", { error, gameId });
        }
    }

    private async seedGameRoomStorage(game: Game) {
        try {
            const room = this.room.context.parties.main?.get(game.id);
            if (!room) {
                console.warn("[Lobby] Game room stub unavailable for seeding", { gameId: game.id });
                return;
            }

            // DO stubs require path-only URLs; absolute placeholders throw.
            await room.fetch("/seed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "seedGame", game }),
            });
            console.log("[Lobby] Seeded game room storage", { gameId: game.id });
        } catch (error) {
            console.error("[Lobby] Failed to seed game storage", { error });
        }
    }

    private buildJsonResponse(body: unknown, status = 200) {
        return new Response(JSON.stringify(body), {
            status,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    private broadcastGameList() {
        this.room.broadcast(
            JSON.stringify({
                type: "roomsUpdate",
                rooms: Array.from(games.values()),
            })
        );
    }

    private async persistGame(game: Game) {
        games.set(game.id, game);
        const storageKey = this.room.id === SINGLETON_ROOM_ID ? game.id : this.room.id;
        try {
            await this.storage.put(storageKey, game);
        } catch (error) {
            console.error("[Game] Failed to persist game", { storageKey, error });
        }

        if (this.room.id !== SINGLETON_ROOM_ID) {
            await this.syncGameToLobby(game);
            return;
        }

        await this.seedGameRoomStorage(game);
    }

    private async syncGameToLobby(game: Game) {
        try {
            const lobbyRoom = this.room.context.parties.main?.get(SINGLETON_ROOM_ID);
            if (!lobbyRoom) {
                console.warn("[Game] Lobby stub unavailable for sync", { gameId: game.id });
                return;
            }

            await lobbyRoom.fetch("/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "syncGame", game }),
            });
        } catch (error) {
            console.error("[Game] Failed to sync lobby storage", { error });
        }
    }

    private async notifyLobbyDeletion(gameId: string) {
        try {
            const lobbyRoom = this.room.context.parties.main?.get(SINGLETON_ROOM_ID);
            if (!lobbyRoom) {
                console.warn("[Game] Lobby stub unavailable for deletion sync", { gameId });
                return;
            }

            await lobbyRoom.fetch("/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "deleteGame", gameId }),
            });
        } catch (error) {
            console.error("[Game] Failed to notify lobby about deletion", { error });
        }
    }

    private async saveAndBroadcastGame(reason: string) {
        if (!this.game) {
            return;
        }

        await this.persistGame(this.game);

        this.room.broadcast(
            JSON.stringify({
                type: "gameState",
                game: this.game,
                reason,
            })
        );

        if (this.room.id === SINGLETON_ROOM_ID) {
            this.broadcastGameList();
        }
    }

    private async deleteGame() {
        try {
            await this.storage.delete(this.room.id);
        } catch (error) {
            console.error("[Game] Failed to delete room storage", { error });
        }

        games.delete(this.room.id);

        await this.notifyLobbyDeletion(this.room.id);
    }
}

const _workerCheck: Party.Worker = GameServer;
void _workerCheck;
