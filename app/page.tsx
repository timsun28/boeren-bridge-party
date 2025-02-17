import { SINGLETON_ROOM_ID } from "@/party/lobby";
import { PARTYKIT_URL } from "@/app/env";
import { Game } from "@/types/game";
import { RoomList } from "@/app/RoomList";

// Use the same URL pattern as the chat example
const partyUrl = `${PARTYKIT_URL}/party/${SINGLETON_ROOM_ID}`;

export const revalidate = 0;

export default async function GameListPage() {
    const res = await fetch(`${PARTYKIT_URL}/party/${SINGLETON_ROOM_ID}`, {
        next: { revalidate: 0 },
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rooms = data.rooms as Game[];

    return (
        <div className="min-h-screen bg-stone-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    <div>
                        <h1 className="text-4xl font-medium text-stone-900">Boeren Bridge</h1>
                        <p className="mt-2 text-lg text-stone-600">Join a game or create your own</p>
                    </div>
                    <RoomList initialRooms={rooms} />
                </div>
            </div>
        </div>
    );
}
