"use server";

import { redirect } from "next/navigation";
import type { Game } from "@/types/game";

export async function createRoom(formData: FormData) {
    console.log("Starting createRoom with formData:", Object.fromEntries(formData));

    const roomName = formData.get("roomName")?.toString();
    if (!roomName?.trim()) {
        console.error("Room creation failed: Empty room name");
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
        totalRounds: 7, // Set a default value
        tricksPerRound: [],
    };

    try {
        const url = `${process.env.NEXT_PUBLIC_PARTYKIT_URL}/party/${newGame.id}`;
        console.log("Attempting to create room at:", url);

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(newGame),
            headers: {
                "Content-Type": "application/json",
            },
            cache: "no-store",
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

        console.log("Room created successfully, redirecting to:", `/room/${newGame.id}`);
    } catch (error) {
        console.error("Error in createRoom:", {
            error,
            url: `${process.env.NEXT_PUBLIC_PARTYKIT_URL}/party/${newGame.id}`,
            env: process.env.NEXT_PUBLIC_PARTYKIT_URL,
        });
        throw error;
    } finally {
        redirect(`/room/${newGame.id}`);
    }
}
