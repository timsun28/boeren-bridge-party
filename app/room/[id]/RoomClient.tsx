"use client";
import { useState, useEffect } from "react";
import type { Game, Player } from "@/types/game";
import { usePartySocket } from "partysocket/react";
import { PARTYKIT_HOST } from "@/app/env";
import { useRouter } from "next/navigation";

interface RoomClientProps {
    roomId: string;
    initialGame: Game;
    playerName: string;
}

export default function RoomClient({ roomId, initialGame, playerName }: RoomClientProps) {
    const router = useRouter();
    const initialPlayer = initialGame?.players.find((player) => player.name === playerName) ?? null;
    const [game, setGame] = useState<Game | null>(initialGame);
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [predictedTricks, setPredictedTricks] = useState<number | null>(initialPlayer?.predictedTricks ?? null);
    const [tempActualTricks, setTempActualTricks] = useState<number | null>(initialPlayer?.actualTricks ?? null);
    const [joinError, setJoinError] = useState<string | null>(null);
    const [playerId] = useState(() => {
        if (typeof window === "undefined") {
            return "";
        }
        const key = `boeren-bridge-player-${roomId}-${playerName}`;
        const existing = window.localStorage.getItem(key);
        if (existing) {
            return existing;
        }
        const nextId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        window.localStorage.setItem(key, nextId);
        return nextId;
    });
    console.log("[RoomClient] Render", {
        roomId,
        playerName,
        initialPlayers: initialGame?.players?.length ?? 0,
        currentPlayers: game?.players?.length ?? 0,
    });
    useEffect(() => {
        if (!playerName) {
            console.warn("[RoomClient] Player name missing on mount, redirecting", { roomId });
            router.replace("/");
        }
    }, [playerName, roomId, router]);

    const socket = usePartySocket({
        host: PARTYKIT_HOST,
        party: "main",
        room: roomId,
        onOpen() {
            console.log("[RoomClient] Socket open", {
                roomId,
                playerName,
                url: `${PARTYKIT_HOST}/parties/main/${roomId}`,
            });
            if (playerName) {
                socket.send(
                    JSON.stringify({
                        type: "joinGame",
                        playerName,
                        playerId,
                    })
                );
                console.log("[RoomClient] Sent joinGame message", { roomId, playerName });
            }
        },
        onMessage(event) {
            const data = JSON.parse(event.data);
            console.log("[RoomClient] Message received", { roomId, type: data.type, payload: data });
            if (data.type === "gameState") {
                setJoinError(null);
                setGame(data.game);
                const player =
                    data.game.players.find((p: Player) => p.id === playerId) ??
                    data.game.players.find((p: Player) => p.name === playerName);
                if (player) {
                    setCurrentPlayer(player);
                    setPredictedTricks(player.tempPrediction ?? player.predictedTricks ?? null);
                    setTempActualTricks(player.actualTricks ?? null);
                } else {
                    console.warn("[RoomClient] Current player not found in updated game", {
                        roomId,
                        playerName,
                        players: data.game.players?.map((p: Player) => p.name) ?? [],
                    });
                }
            } else if (data.type === "error") {
                console.error("Game error:", data.message);
                setJoinError(typeof data.message === "string" ? data.message : "Unable to join this room.");
            }
        },
        onClose() {
            console.warn("[RoomClient] Connection closed", { roomId });
        },
        onError(error) {
            console.error("[RoomClient] WebSocket error", { roomId, error });
        },
    });

    useEffect(() => {
        if (!game) {
            return;
        }
        console.log("[RoomClient] Game state updated", {
            roomId,
            playerCount: game.players?.length ?? 0,
            status: game.status,
            currentRound: game.currentRound,
        });
    }, [game, roomId]);

    const handlePredictTricks = (tricks: number) => {
        if (!currentPlayer) return;
        setPredictedTricks(tricks);
        socket.send(
            JSON.stringify({
                type: "updatePrediction",
                playerId: currentPlayer.id,
                tricks,
            })
        );
    };

    const handleActualTricks = (tricks: number) => {
        if (!currentPlayer || predictedTricks == null) return;
        setTempActualTricks(tricks);
    };

    const handleConfirmRound = () => {
        if (!currentPlayer) return;
        socket.send(
            JSON.stringify({
                type: "confirmRound",
                playerId: currentPlayer.id,
            })
        );
    };

    const handleEditRound = (roundNumber: number) => {
        if (!currentPlayer) return;
        socket.send(
            JSON.stringify({
                type: "editRound",
                roundNumber,
                playerId: currentPlayer.id,
            })
        );
    };

    const handleStartGame = () => {
        if (!currentPlayer) return;
        socket.send(JSON.stringify({ type: "startGame" }));
    };

    const handleLeaveGame = () => {
        if (!currentPlayer) return;
        socket.send(
            JSON.stringify({
                type: "leaveGame",
                playerId: currentPlayer.id,
            })
        );
        router.replace("/");
    };

    const handleConfirmPrediction = () => {
        if (!currentPlayer || predictedTricks == null) return;
        socket.send(
            JSON.stringify({
                type: "confirmPrediction",
                playerId: currentPlayer.id,
                tricks: predictedTricks,
            })
        );
    };

    const handleConfirmActual = () => {
        if (!currentPlayer || tempActualTricks == null || predictedTricks == null) return;
        socket.send(
            JSON.stringify({
                type: "submitTricks",
                playerId: currentPlayer.id,
                predicted: predictedTricks,
                actual: tempActualTricks,
            })
        );
    };

    const renderTrickButtons = (
        onSelect: (tricks: number) => void,
        disabled: boolean = false,
        showTotalTricks: boolean = true
    ) => {
        const isLastPredictor =
            game?.players.filter((p) => p.predictedTricks === undefined && p.tempPrediction === undefined).length === 1;
        const predictedSum =
            game?.players.reduce((sum, p) => sum + (p.tempPrediction ?? p.predictedTricks ?? 0), 0) || 0;

        return (
            <div>
                {showTotalTricks && (
                    <div className="mb-4 text-gray-600 dark:text-gray-400">
                        Total tricks in round: {game?.currentTricks || 0}
                        {isLastPredictor && <div className="mt-1">Current sum of predictions: {predictedSum}</div>}
                    </div>
                )}
                <div className="grid grid-cols-5 gap-2 w-full max-w-md">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                        const wouldMakeEqual = isLastPredictor && predictedSum + num === game?.currentTricks;
                        const buttonDisabled = disabled || wouldMakeEqual;

                        return (
                            <button
                                key={num}
                                onClick={() => onSelect(num)}
                                disabled={buttonDisabled}
                                className={`
                                    relative 
                                    font-bold py-4 px-6 rounded-lg text-xl
                                    transform transition-all duration-100
                                    ${
                                        buttonDisabled
                                            ? "bg-gray-400 cursor-not-allowed"
                                            : `
                                                bg-blue-600 hover:bg-blue-700
                                                active:top-1 active:shadow-[0_0px_0_0_#1e40af]
                                                shadow-[0_4px_0_0_#1e40af]
                                                hover:shadow-[0_4px_0_0_#1e40af]
                                            `
                                    }
                                    text-white
                                `}
                            >
                                {num}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderRoundHistory = () => {
        if (!game?.rounds.length) return null;

        return (
            <div className="w-full max-w-2xl mt-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Round History</h2>
                <div className="space-y-4">
                    {[...game.rounds].reverse().map((round) => (
                        <div key={round.roundNumber} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-medium">Round {round.roundNumber}</h3>
                                {!round.completed && (
                                    <button
                                        onClick={() => handleEditRound(round.roundNumber)}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {game.players.map((player) => (
                                    <div key={player.id} className="text-sm">
                                        <div className="font-medium">{player.name}</div>
                                        <div className="text-gray-500">
                                            Predicted: {round.predictions[player.id]} | Actual:{" "}
                                            {round.actual[player.id]} | Score: {round.scores[player.id]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const canPredict = game?.status === "predicting" && currentPlayer?.predictedTricks === undefined;
    const canSubmitActual = game?.status === "playing" && currentPlayer?.predictedTricks !== undefined;
    const needsConfirmation =
        game?.status === "confirming" && !game.roundConfirmations[game.currentRound]?.includes(currentPlayer?.id || "");

    const MIN_PLAYERS = 2; // Minimum players needed to start
    const hasEnoughPlayers = (game?.players.length ?? 0) >= MIN_PLAYERS;

    // Add this helper function to check if a player has confirmed
    const hasPlayerConfirmed = (playerId: string) => {
        return game?.status === "confirming" && game.roundConfirmations[game.currentRound]?.includes(playerId);
    };

    // Add this helper to get round phase
    const getRoundPhase = (roundIndex: number) => {
        const totalRoundsPerPhase = game?.totalRounds || 0;
        if (roundIndex < totalRoundsPerPhase) return "Ascending";
        if (roundIndex === totalRoundsPerPhase) return "Middle (No Trump)";
        return "Descending";
    };

    if (joinError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-linear-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                <div className="w-full max-w-lg rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-200">
                    <h1 className="text-2xl font-semibold mb-2 text-red-100">Unable to join</h1>
                    <p className="text-sm text-red-100/80">{joinError}</p>
                    <button
                        onClick={() => router.replace("/")}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Back to lobby
                    </button>
                </div>
            </div>
        );
    }

    if (!game?.started && !hasEnoughPlayers) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-linear-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">{game?.name || "Loading..."}</h1>

                <div className="w-full max-w-2xl mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Waiting for Players</h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
                        <div className="space-y-2">
                            {game?.players.map((player) => (
                                <div
                                    key={player.id}
                                    className="flex items-center space-x-2 text-gray-800 dark:text-white"
                                >
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    <span>{player.name}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 text-sm text-gray-500">
                            Waiting for {MIN_PLAYERS - (game?.players.length || 0)} more player(s)...
                        </div>
                    </div>
                </div>

                {hasEnoughPlayers && (
                    <button
                        onClick={handleStartGame}
                        className="mt-8 px-8 py-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                        Start Game
                    </button>
                )}

                <div className="text-center text-gray-500 dark:text-gray-400">
                    Share this link with your friends to join:
                    <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded-lg">
                        {typeof window !== "undefined" ? window.location.href : ""}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center p-8 bg-linear-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="w-full max-w-2xl flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                    {game?.name || "Loading..."} - Round {game?.currentRound}
                </h1>
                <button
                    onClick={handleLeaveGame}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    Leave Game
                </button>
            </div>

            <div className="w-full max-w-2xl mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Players</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {game?.players.map((player) => (
                        <div
                            key={player.id}
                            className={`p-4 rounded-lg ${
                                player.id === currentPlayer?.id
                                    ? "bg-blue-100 dark:bg-blue-900"
                                    : "bg-white dark:bg-gray-800"
                            }`}
                        >
                            <div className="flex justify-between items-center">
                                <div className="font-medium text-gray-800 dark:text-white">{player.name}</div>
                                {hasPlayerConfirmed(player.id) && (
                                    <svg
                                        className="h-5 w-5 text-green-500"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fillRule="evenodd"
                                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                Score: {player.score}
                                {(player.predictedTricks ?? player.tempPrediction) !== undefined && (
                                    <span className="ml-2">
                                        (Predicted: {player.predictedTricks ?? player.tempPrediction})
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-8 w-full items-center flex flex-col">
                {game?.status === "predicting" && (
                    <div className="text-center">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
                            {canPredict ? "Predict your tricks" : "Predictions locked"}
                        </h2>
                        {renderTrickButtons(handlePredictTricks, !canPredict, true)}
                        {predictedTricks != null && currentPlayer?.predictedTricks === undefined && (
                            <button
                                onClick={handleConfirmPrediction}
                                className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Confirm Prediction: {predictedTricks}
                            </button>
                        )}
                    </div>
                )}

                {game?.status === "playing" && (
                    <div className="text-center">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
                            Actual tricks taken
                        </h2>
                        {renderTrickButtons(handleActualTricks, !canSubmitActual, false)}
                        {tempActualTricks !== undefined && canSubmitActual && (
                            <button
                                onClick={handleConfirmActual}
                                className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Confirm Actual Tricks: {tempActualTricks}
                            </button>
                        )}
                        {currentPlayer?.actualTricks !== undefined && (
                            <div className="mt-2 text-gray-600 dark:text-gray-400">
                                Submitted tricks: {currentPlayer.actualTricks}
                            </div>
                        )}
                    </div>
                )}

                {needsConfirmation && (
                    <button
                        onClick={handleConfirmRound}
                        className="px-8 py-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                        Confirm Round Results
                    </button>
                )}
            </div>

            <div className="text-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                    Round {game?.currentRound} - {getRoundPhase((game?.currentRound ?? 0) - 1)}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">Cards this round: {game?.currentTricks}</p>
            </div>

            {renderRoundHistory()}
        </div>
    );
}
