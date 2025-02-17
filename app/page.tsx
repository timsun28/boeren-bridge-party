import { SINGLETON_ROOM_ID } from "@/party/lobby";
import { PARTYKIT_URL } from "@/app/env";
import { Game } from "@/types/game";
import { RoomList } from "@/app/RoomList";

// Use the same URL pattern as the chat example
const partyUrl = `${PARTYKIT_URL}/party/${SINGLETON_ROOM_ID}`;

export const revalidate = 0;

export default async function GameListPage() {
    try {
        // Fetch games for server rendering with a GET request to the server
        const res = await fetch(partyUrl, { next: { revalidate: 0 } });

        if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }

        const text = await res.text();
        try {
            const data = JSON.parse(text);
            const rooms = (data.rooms ?? []) as Game[];

            return (
                <div className="w-full flex flex-col gap-6">
                    <h1 className="text-4xl font-medium">Boeren Bridge Games</h1>
                    <RoomList initialRooms={rooms} />
                </div>
            );
        } catch (e) {
            console.error("Failed to parse response:", text);
            throw e;
        }
    } catch (error) {
        console.error("Error in GameListPage:", error);
        return (
            <div className="w-full flex flex-col gap-6">
                <h1 className="text-4xl font-medium">Boeren Bridge Games</h1>
                <div className="text-red-500">Failed to load games. Please try again later.</div>
            </div>
        );
    }
}
