"use client";
import { useState } from "react";
import { Game } from "@/types/game";
import usePartySocket from "partysocket/react";
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
        room: "lobby",
        onOpen() {
            console.log("Socket connected to lobby");
        },
        onMessage(event) {
            console.log({ event });
            try {
                const data = JSON.parse(event.data);
                console.log("Received lobby message:", data);
                if (data.type === "roomsUpdate" && Array.isArray(data.rooms)) {
                    setRooms(data.rooms);
                }
            } catch (error) {
                console.error("Error handling message:", error);
            }
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

            <div>
                <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-3">Available Games</h2>
                <div className="space-y-2">
                    {rooms.map((room) => (
                        <button
                            key={room.id}
                            onClick={() => handleJoinRoom(room.id)}
                            className="w-full bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4"
                        >
                            <div className="flex-1">
                                <h3 className="font-medium text-gray-900 dark:text-white">{room.name}</h3>
                                <p className="text-sm text-gray-500">{room.players.length} players</p>
                            </div>
                            <span className="text-blue-500">Join →</span>
                        </button>
                    ))}
                    {rooms.length === 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
                            <p className="text-gray-500">No games available yet.</p>
                            <p className="text-sm text-gray-400 mt-1">Create one to get started!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
