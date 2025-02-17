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
        totalRounds: 0,
        tricksPerRound: [],
    };

    const url = `${process.env.NEXT_PUBLIC_PARTYKIT_URL}/party/${newGame.id}`;
    console.log("Creating room:", {
        url,
        game: newGame,
        env: {
            partyKitUrl: process.env.NEXT_PUBLIC_PARTYKIT_URL,
            nodeEnv: process.env.NODE_ENV,
        },
    });

    try {
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(newGame),
            headers: {
                "Content-Type": "application/json",
            },
        });

        console.log("Server response:", {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
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
        console.log("Room created successfully, redirecting to:", `/room/${newGame.id}`);

        redirect(`/room/${newGame.id}`);
    } catch (error) {
        console.error("Error in createRoom:", {
            error,
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}
