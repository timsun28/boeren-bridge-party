import { redirect } from "next/navigation";
import RoomClient from "./RoomClient";
import { PARTYKIT_URL } from "@/app/env";

async function getGame(id: string) {
    const requestUrl = `${PARTYKIT_URL}/party/${id}`;
    console.log("[RoomPage] Fetching game", { id, requestUrl });

    let response: Response;
    try {
        response = await fetch(requestUrl, {
            method: "GET",
            next: { revalidate: 0 },
        });
    } catch (error) {
        console.error("[RoomPage] Fetch threw", { id, error });
        redirect("/");
    }

    const rawBody = await response.text();
    console.log("[RoomPage] Fetch response", {
        id,
        status: response.status,
        ok: response.ok,
        bodyPreview: rawBody.slice(0, 200),
    });

    if (!response.ok) {
        console.error("[RoomPage] Fetch not ok, redirecting", { id, status: response.status, rawBody });
        redirect("/");
    }

    try {
        const data = JSON.parse(rawBody);
        console.log("[RoomPage] Parsed game payload", { id, hasGame: !!data?.game });
        return data.game; // Server returns { game: Game }
    } catch (error) {
        console.error("[RoomPage] Failed to parse game response", { id, error, rawBody });
        redirect("/");
    }
}

export default async function Room({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ player?: string } | undefined>;
}) {
    const { id } = await params;
    if (!id) {
        console.warn("[RoomPage] Missing room id in params, redirecting");
        redirect("/");
    }
    const resolvedSearchParams = (await searchParams) ?? {};
    const playerName = resolvedSearchParams.player;

    const decodedPlayerName = playerName ? decodeURIComponent(playerName) : "";
    const trimmedPlayerName = decodedPlayerName.trim();

    if (!trimmedPlayerName) {
        console.warn("[RoomPage] Missing player name, redirecting", {
            id,
            rawPlayer: playerName,
        });
        redirect("/");
    }

    const game = await getGame(id);
    if (!game) {
        console.error("[RoomPage] Game fetch returned no game, redirecting", { id });
        redirect("/");
    }

    return <RoomClient roomId={id} initialGame={game} playerName={trimmedPlayerName} />;
}
