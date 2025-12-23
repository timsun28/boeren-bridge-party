import { SINGLETON_ROOM_ID } from "@/party/constants";
import { PARTYKIT_URL } from "@/app/env";
import { Game } from "@/types/game";
import { RoomList } from "@/app/RoomList";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";

export const revalidate = 0;

export default async function GameListPage() {
    const res = await fetch(`${PARTYKIT_URL}/party/${SINGLETON_ROOM_ID}`, {
        next: { revalidate: 0 },
    });

    let rooms: Game[] = [];
    let errorMessage: string | null = null;

    if (!res.ok) {
        errorMessage = `Lobby unavailable (${res.status} ${res.statusText}).`;
    } else {
        try {
            const data = (await res.json()) as { rooms?: Game[] } | undefined;
            rooms = Array.isArray(data?.rooms) ? data.rooms : [];
        } catch {
            errorMessage = "Lobby data unavailable. Please try again.";
        }
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gray-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-medium text-gray-100">Boeren Bridge</h1>
                            <p className="mt-2 text-lg text-gray-400">Join a game or create your own</p>
                        </div>
                        {errorMessage ? (
                            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-amber-200">
                                {errorMessage}
                            </div>
                        ) : null}
                        <RoomList initialRooms={rooms} />
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    );
}
