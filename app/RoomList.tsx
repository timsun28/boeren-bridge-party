"use client";
import { useState } from "react";
import { Game } from "@/types/game";
import usePartySocket from "partysocket/react";
import { SINGLETON_ROOM_ID } from "@/party/lobby";
import { createRoom } from "@/app/actions";

interface RoomListProps {
    initialRooms: Game[];
}

export function RoomList({ initialRooms }: RoomListProps) {
    const [rooms, setRooms] = useState<Game[]>(initialRooms);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    usePartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
        room: SINGLETON_ROOM_ID,
        onOpen() {
            console.log("[RoomList] Connected to lobby");
        },
        onMessage(event) {
            try {
                const data = JSON.parse(event.data);
                console.log("[RoomList] Received message:", data);
                if (data.type === "roomsUpdate" && Array.isArray(data.rooms)) {
                    setRooms(data.rooms);
                }
            } catch (error) {
                console.error("[RoomList] Error handling message:", error);
            }
        },
    });

    const handleJoinRoom = (roomId: string) => {
        setSelectedRoomId(roomId);
        setShowNamePrompt(true);
    };

    const confirmJoinRoom = () => {
        if (!playerName.trim() || !selectedRoomId) return;
        window.location.href = `/game/${selectedRoomId}?player=${encodeURIComponent(playerName)}`;
    };

    if (rooms.length === 0) {
        return (
            <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <p className="text-gray-600 dark:text-gray-300">No active games. Create one to get started!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {showNamePrompt && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4 dark:text-white">Join Game</h2>
                        <input
                            type="text"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white mb-4"
                            placeholder="Enter your name"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={confirmJoinRoom}
                                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Join
                            </button>
                            <button
                                onClick={() => {
                                    setShowNamePrompt(false);
                                    setSelectedRoomId(null);
                                }}
                                className="px-4 py-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4 dark:text-white">Create New Game</h2>
                <form
                    action={async (formData) => {
                        try {
                            await createRoom(formData);
                        } catch (error) {
                            if (!(error as Error).message?.includes("NEXT_REDIRECT")) {
                                console.error("Error creating room:", error);
                            }
                        }
                    }}
                >
                    <input
                        type="text"
                        name="roomName"
                        placeholder="Enter game name"
                        className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 dark:text-white mb-4"
                        required
                    />
                    <button
                        type="submit"
                        className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        Create Game
                    </button>
                </form>
            </div>

            <div className="grid gap-4">
                {rooms.map((room) => (
                    <div
                        key={room.id}
                        className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                                    {room.name || "Unnamed Game"}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Players: {room.players.length}
                                </p>
                            </div>
                            <button
                                onClick={() => handleJoinRoom(room.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                                {room.started ? "Spectate" : "Join"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
