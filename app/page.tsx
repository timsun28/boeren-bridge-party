import { SINGLETON_ROOM_ID } from "@/party";
import { PARTYKIT_URL } from "@/app/env";
import { Game } from "@/types/game";
import { RoomList } from "@/app/RoomList";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";

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
        <ErrorBoundary>
            <div className="min-h-screen bg-gray-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-medium text-gray-100">Boeren Bridge</h1>
                            <p className="mt-2 text-lg text-gray-400">Join a game or create your own</p>
                        </div>
                        <RoomList initialRooms={rooms} />
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}
