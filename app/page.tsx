import { SINGLETON_ROOM_ID } from "@/party/lobby";
import { PARTYKIT_URL } from "@/app/env";
import { Game } from "@/types/game";
import { RoomList } from "@/app/RoomList";

// Use the same URL pattern as the chat example
const partyUrl = `${PARTYKIT_URL}/party/${SINGLETON_ROOM_ID}`;

export const revalidate = 0;

export default async function GameListPage() {
    // Fetch games for server rendering with a GET request to the server
    const res = await fetch(partyUrl, { next: { revalidate: 0 } });
    const data = await res.json();
    const rooms = (data.rooms ?? []) as Game[];

    return (
        <div className="w-full flex flex-col gap-6">
            <h1 className="text-4xl font-medium">Boeren Bridge Games</h1>
            <RoomList initialRooms={rooms} />
        </div>
    );
}
