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

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function Room({ params }: PageProps) {
    const resolvedParams = await params;
    const initialGame = await getGame(resolvedParams.id);

    return <RoomClient roomId={resolvedParams.id} initialGame={initialGame} />;
}
