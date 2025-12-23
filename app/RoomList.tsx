"use client";
import { useState } from "react";
import { usePartySocket } from "partysocket/react";
import { SINGLETON_ROOM_ID } from "@/party/constants";
import { PARTYKIT_HOST } from "@/app/env";
import type { Game } from "@/types/game";
import ConnectionStatus from "./components/ConnectionStatus";
import { createRoom } from "@/app/actions";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

interface RoomListProps {
    initialRooms: Game[];
}

export function RoomList({ initialRooms }: RoomListProps) {
    const [rooms, setRooms] = useState<Game[]>(initialRooms);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<Game | null>(null);
    const [playerName, setPlayerName] = useState("");
    const router = useRouter();

    const socket = usePartySocket({
        host: PARTYKIT_HOST,
        party: "main",
        room: SINGLETON_ROOM_ID,
        onMessage(event) {
            const data = JSON.parse(event.data);
            console.log("[Lobby] Message received", { type: data.type, payload: data });
            if (data.type === "roomsUpdate") {
                setRooms(data.rooms);
            }
        },
        onOpen() {
            console.log("[Lobby] Socket open", {
                room: SINGLETON_ROOM_ID,
                url: `${PARTYKIT_HOST}/parties/main/${SINGLETON_ROOM_ID}`,
            });
            setIsLoading(false);
        },
        onClose() {
            console.warn("[Lobby] Socket closed", { room: SINGLETON_ROOM_ID });
            setIsLoading(true);
        },
    });

    const handleJoinRoom = (room: Game) => {
        console.log("[Lobby] Join dialog opened", { roomId: room.id, roomName: room.name });
        setSelectedRoom(room);
    };

    const handleConfirmJoin = () => {
        if (selectedRoom && playerName.trim()) {
            console.log("[Lobby] Confirm join", {
                roomId: selectedRoom.id,
                roomName: selectedRoom.name,
                playerName: playerName.trim(),
            });
            router.push(`/room/${selectedRoom.id}?player=${encodeURIComponent(playerName)}`);
        }
    };

    if (isLoading) {
        return <div className="text-center py-8 text-gray-300">Loading games...</div>;
    }

    return (
        <>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Create New Game Card */}
                <li className="col-span-1">
                    <div className="rounded-lg bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl transition-all">
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
                            className="p-6"
                        >
                            <div className="flex flex-col gap-4">
                                <h3 className="font-medium text-gray-200">Create New Game</h3>
                                <input
                                    type="text"
                                    name="roomName"
                                    placeholder="Game Name"
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                                             text-gray-200 placeholder-gray-400
                                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                <input
                                    type="text"
                                    name="playerName"
                                    placeholder="Your Name"
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                                             text-gray-200 placeholder-gray-400
                                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                <button
                                    type="submit"
                                    className="w-full px-4 py-2 bg-blue-600 text-gray-100 rounded-lg 
                                             hover:bg-blue-700 transition-colors"
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
                        <div className="rounded-lg bg-gray-800 border border-gray-700 shadow-lg hover:shadow-xl transition-all">
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-gray-200">{room.name || "Unnamed Game"}</h3>
                                        <p className="text-sm text-gray-400">
                                            {room.players.length} player{room.players.length !== 1 && "s"}
                                        </p>
                                    </div>
                                    <span
                                        className={`rounded-full px-2 py-1 text-sm ${
                                            room.started
                                                ? "bg-amber-900/50 text-amber-200"
                                                : "bg-emerald-900/50 text-emerald-200"
                                        }`}
                                    >
                                        {room.started ? "In Progress" : "Waiting"}
                                    </span>
                                </div>

                                {/* Player List */}
                                {room.players.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-medium text-gray-400">Players</h4>
                                        <ul className="space-y-1">
                                            {room.players.map((player) => (
                                                <li key={player.id} className="text-sm text-gray-300">
                                                    {player.name}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleJoinRoom(room)}
                                    className="block w-full text-center px-4 py-2 bg-blue-600 text-gray-100 
                                             rounded-lg hover:bg-blue-700 transition-colors"
                                    disabled={room.started}
                                >
                                    {room.started ? "Spectate" : "Join Game"}
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>

            <AlertDialog open={!!selectedRoom} onOpenChange={() => setSelectedRoom(null)}>
                <AlertDialogContent className="bg-gray-800 border-gray-700">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-gray-100">Join {selectedRoom?.name}</AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400">
                            Enter your name to join the game
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <input
                            type="text"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            placeholder="Your name"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                                     text-gray-200 placeholder-gray-400
                                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmJoin}
                            className="bg-blue-600 text-gray-100 hover:bg-blue-700"
                            disabled={!playerName.trim()}
                        >
                            Join Game
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ConnectionStatus socket={socket} />
        </>
    );
}
