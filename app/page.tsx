"use client";
import { useState } from "react";
import type { Game } from "@/types/game";
import usePartySocket from "partysocket/react";
import { createRoom } from "@/app/actions";

export default function Home() {
    const [rooms, setRooms] = useState<Game[]>([]);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Update refresh function
    const refreshRooms = async () => {
        console.log("Manually refreshing rooms");
        try {
            setIsLoading(true);
            const response = await fetch(`${process.env.NEXT_PUBLIC_PARTYKIT_URL}/party/lobby`);
            console.log("Refresh response:", response.status);
            const data = await response.json();
            console.log("Refresh data:", data);
            if (data.type === "roomsUpdate") {
                setRooms(data.rooms);
            }
        } catch (error) {
            console.error("Refresh error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // // Add auto-refresh interval
    // useEffect(() => {
    //     const interval = setInterval(refreshRooms, 5000); // Refresh every 5 seconds
    //     return () => clearInterval(interval);
    // }, []);

    // Update socket connection with better error handling
    usePartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
        room: "lobby",
        onOpen() {
            console.log("Socket connected to lobby");
            refreshRooms();
        },
        onMessage(event) {
            try {
                const data = JSON.parse(event.data);
                console.log("Received lobby message:", data);
                if (data.type === "roomsUpdate" && Array.isArray(data.rooms)) {
                    setRooms(data.rooms);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Error handling message:", error);
            }
        },
        onClose() {
            console.log("Socket disconnected, attempting to reconnect...");
            setTimeout(refreshRooms, 1000);
        },
        onError(error) {
            console.error("Socket error:", error);
            setIsLoading(false);
        },
    });

    const handleJoinRoom = (roomId: string) => {
        setSelectedRoomId(roomId);
        setShowNamePrompt(true);
    };

    const confirmJoinRoom = () => {
        if (!playerName.trim() || !selectedRoomId) return;
        window.location.href = `/room/${selectedRoomId}?player=${encodeURIComponent(playerName)}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm p-6">
                <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white">Boeren Bridge</h1>
            </header>

            <main className="container mx-auto max-w-md p-4 space-y-6">
                {showNamePrompt ? (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
                        <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-lg shadow-lg p-6">
                            <h2 className="text-xl font-semibold mb-4 dark:text-white">Join Game</h2>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter your name"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={confirmJoinRoom}
                                    className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                                >
                                    Join
                                </button>
                                <button
                                    onClick={() => {
                                        setShowNamePrompt(false);
                                        setSelectedRoomId(null);
                                    }}
                                    className="px-4 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form
                        action={async (formData) => {
                            try {
                                await createRoom(formData);
                            } catch (error) {
                                // Ignore NEXT_REDIRECT errors as they're expected
                                if (!(error as Error).message?.includes("NEXT_REDIRECT")) {
                                    console.error("Error creating room:", error);
                                }
                            }
                        }}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6"
                    >
                        <h2 className="text-lg font-semibold mb-4 dark:text-white">Create New Game</h2>
                        <input
                            type="text"
                            name="roomName"
                            placeholder="Enter game name"
                            className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                        <button
                            type="submit"
                            className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                        >
                            Create Game
                        </button>
                    </form>
                )}

                {/* Available Games */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-medium text-gray-800 dark:text-white">Available Games</h2>
                        <button
                            onClick={refreshRooms}
                            className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    </div>
                    <div className="space-y-2">
                        {rooms.map((room) => (
                            <button
                                key={room.id}
                                onClick={() => handleJoinRoom(room.id)}
                                className="w-full bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 text-left"
                            >
                                <div className="flex-1 mr-auto">
                                    <h3 className="font-medium text-gray-900 dark:text-white">{room.name}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {room.players.length} players
                                    </p>
                                </div>
                                <span className="text-blue-500 dark:text-blue-400 font-medium">Join →</span>
                            </button>
                        ))}
                        {rooms.length === 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                                <p className="text-gray-500 dark:text-gray-400">No games available yet.</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                    Create one to get started!
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
