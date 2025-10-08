import { redirect } from "next/navigation";
import RoomClient from "./RoomClient";
import { PARTYKIT_URL } from "@/app/env";

async function getGame(id: string) {
    const response = await fetch(`${PARTYKIT_URL}/party/${id}`, {
        method: "GET",
        next: { revalidate: 0 },
    });

    if (response.status !== 200) {
        redirect("/");
    }

    const data = await response.json();
    return data.game; // Server returns { game: Game }
}

export default async function Room({
    params: { id },
    searchParams: { player: playerName },
}: {
    params: { id: string };
    searchParams: { player?: string };
}) {
    if (!playerName) {
        redirect("/");
    }

    const game = await getGame(id);
    if (!game) {
        redirect("/");
    }

    return <RoomClient roomId={id} initialGame={game} playerName={decodeURIComponent(playerName)} />;
}
