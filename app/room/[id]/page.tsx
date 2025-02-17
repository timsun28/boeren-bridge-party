import { redirect } from "next/navigation";
import RoomClient from "./RoomClient";

async function getGame(id: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_PARTYKIT_URL}/party/${id}`, {
        method: "GET",
        next: { revalidate: 0 },
    });
    console.log("Response:", response);
    console.log("Response status:", response.status);
    if (response.status !== 200) {
        redirect("/");
    }

    return response.json();
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ player?: string }>;

export default async function Room(props: { params: Params; searchParams: SearchParams }) {
    const params = await props.params;
    const searchParams = await props.searchParams;

    const id = params.id;
    const playerName = searchParams.player;

    if (!playerName) {
        redirect("/");
    }

    const initialGame = await getGame(id);
    return <RoomClient roomId={id} initialGame={initialGame} playerName={decodeURIComponent(playerName)} />;
}
