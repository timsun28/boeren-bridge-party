import { PARTYKIT_URL } from "@/app/env";
import { SINGLETON_ROOM_ID } from "@/party/constants";

export async function POST(request: Request) {
    try {
        const body = (await request.json().catch(() => undefined)) as { gameId?: string } | undefined;
        const gameId = body?.gameId;
        if (!gameId) {
            return Response.json({ error: "Missing gameId" }, { status: 400 });
        }

        const response = await fetch(`${PARTYKIT_URL}/party/${SINGLETON_ROOM_ID}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "deleteGame", gameId }),
        });

        if (!response.ok) {
            return Response.json({ error: "Failed to delete room" }, { status: 502 });
        }

        return Response.json({ ok: true });
    } catch (error) {
        console.error("[API] Failed to delete room", { error });
        return Response.json({ error: "Failed to delete room" }, { status: 500 });
    }
}
