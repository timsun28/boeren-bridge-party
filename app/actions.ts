"use server";

import { redirect } from "next/navigation";
import type { Game } from "@/types/game";

export async function createRoom(formData: FormData) {
    const roomName = formData.get("roomName")?.toString();
    if (!roomName?.trim()) {
        throw new Error("Room name is required");
    }

    const newGame: Game = {
        id: crypto.randomUUID(),
        name: roomName,
        players: [],
        createdAt: Date.now(),
        currentRound: 1,
        rounds: [],
        roundConfirmations: {},
        status: "predicting",
        currentTricks: 0,
        predictedTricksSum: 0,
        started: false,
        totalRounds: 0,
        tricksPerRound: [],
    };

    console.log("Creating room with data:", newGame);
    console.log("Sending request to:", `${process.env.NEXT_PUBLIC_PARTYKIT_URL}/party/${newGame.id}`);

    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_PARTYKIT_URL}/party/${newGame.id}`, {
            method: "POST",
            body: JSON.stringify(newGame),
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Server response error:", {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
            });
            throw new Error(`Failed to create room: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        console.log("Room created successfully:", responseData);

        redirect(`/room/${newGame.id}`);
    } catch (error) {
        console.error("Error creating room:", error);
        throw error;
    }
}
