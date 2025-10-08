import { redirect } from "next/navigation";
import RoomClient from "./RoomClient";
import { PARTYKIT_URL } from "@/app/env";

async function getGame(id: string) {
    const response = await fetch(`${PARTYKIT_URL}/party/${id}`, {
        method: "GET",
        next: { revalidate: 0 },
    });

    if (!response.ok) {
        redirect("/");
    }

    const data = await response.json();
    return data.game; // Server returns { game: Game }
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
        redirect("/");
    }
    const resolvedSearchParams = (await searchParams) ?? {};
    const playerName = resolvedSearchParams.player;

    const decodedPlayerName = playerName ? decodeURIComponent(playerName) : "";
    const trimmedPlayerName = decodedPlayerName.trim();

    if (!trimmedPlayerName) {
        redirect("/");
    }

    const game = await getGame(id);
    if (!game) {
        redirect("/");
    }

    return <RoomClient roomId={id} initialGame={game} playerName={trimmedPlayerName} />;
}
