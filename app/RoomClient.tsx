"use client";
import { useState, useEffect } from "react";
import usePartySocket from "partysocket/react";
import { Game } from "@/types/game";

interface RoomClientProps {
    roomId: string;
    playerName: string;
    initialGame?: Game;
}

export function RoomClient({ roomId, playerName, initialGame }: RoomClientProps) {
    const [game, setGame] = useState<Game | undefined>(initialGame);

    const socket = usePartySocket({
        host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
        room: roomId,
        onOpen() {
            console.log("Connected to game room:", roomId);
            socket.send(JSON.stringify({ type: "joinGame", playerName }));
        },
        onMessage(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "gameState") {
                    setGame(data.game);
                } else if (data.type === "error") {
                    console.error("Game error:", data.message);
                }
            } catch (error) {
                console.error("Error handling message:", error);
            }
        },
    });

    useEffect(() => {
        return () => {
            socket.send(JSON.stringify({ type: "leaveGame", playerId: socket.id }));
        };
    }, [socket]);

    if (!game) {
        return <div>Loading game...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{game.name}</h1>
            <div>
                <h2 className="text-lg font-medium mb-2">Players</h2>
                <ul className="space-y-2">
                    {game.players.map((player) => (
                        <li key={player.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                            {player.name} - Score: {player.score}
                        </li>
                    ))}
                </ul>
            </div>
            {/* Add your game-specific UI components here */}
        </div>
    );
}
