"use client";
import { useState } from "react";
import { Game } from "@/types/game";
import { usePartySocket } from "partysocket/react";
import { SINGLETON_ROOM_ID } from "@/party/lobby";
import Link from "next/link";
import { PARTYKIT_HOST } from "@/app/env";
import ConnectionStatus from "@/app/components/ConnectionStatus";

interface RoomListProps {
    initialRooms: Game[];
}

export function RoomList({ initialRooms }: RoomListProps) {
    const [rooms, setRooms] = useState<Game[]>(initialRooms);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    const socket = usePartySocket({
        host: PARTYKIT_HOST,
        party: "main",
        room: SINGLETON_ROOM_ID,
        onMessage(event) {
            const data = JSON.parse(event.data);
            if (data.type === "roomsUpdate") {
                setRooms(data.rooms);
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

    return (
        <>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Create New Game Card */}
                <li className="col-span-1">
                    <div className="rounded-lg bg-white outline outline-1 outline-stone-200 shadow hover:shadow-md">
                        <form action="/api/create-room" method="POST" className="p-6">
                            <div className="flex flex-col gap-4">
                                <h3 className="font-medium">Create New Game</h3>
                                <input
                                    type="text"
                                    name="roomName"
                                    placeholder="Game Name"
                                    className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                <button
                                    type="submit"
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Create Game
                                </button>
                            </div>
                        </form>
                    </div>
                </li>

                {/* Game List */}
                {rooms.map((room) => (
                    <li key={room.id} className="col-span-1">
                        <div className="rounded-lg bg-white outline outline-1 outline-stone-200 shadow hover:shadow-md">
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium">{room.name || "Unnamed Game"}</h3>
                                        <p className="text-sm text-stone-500">
                                            {room.players.length} player{room.players.length !== 1 && "s"}
                                        </p>
                                    </div>
                                    <span className="bg-stone-100 text-stone-600 rounded-full px-2 py-1 text-sm">
                                        {room.started ? "In Progress" : "Waiting"}
                                    </span>
                                </div>

                                {/* Player List */}
                                {room.players.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-stone-500">Players</h4>
                                        <ul className="space-y-1">
                                            {room.players.map((player) => (
                                                <li key={player.id} className="text-sm">
                                                    {player.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <Link
                                    href={`/room/${room.id}`}
                                    className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    {room.started ? "Spectate" : "Join Game"}
                                </Link>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
            <ConnectionStatus socket={socket} />
        </>
    );
}
