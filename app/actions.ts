"use server";

import { PARTYKIT_URL } from "@/app/env";
import { redirect } from "next/navigation";

export async function createRoom(formData: FormData) {
    const roomName = formData.get("roomName")?.toString();
    const playerName = formData.get("playerName")?.toString();
    if (!roomName?.trim()) {
        throw new Error("Room name is required");
    }
    if (!playerName?.trim()) {
        throw new Error("Player name is required");
    }

    const response = await fetch(`${PARTYKIT_URL}/party/lobby`, {
        method: "POST",
        body: JSON.stringify({
            type: "createGame",
            name: roomName,
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error("Failed to create room");
    }

    // Get the created game data with its ID
    const game = await response.json();

    // Redirect to the specific game room using its ID
    redirect(`/room/${game.id}?player=${encodeURIComponent(playerName.trim())}`);
}
