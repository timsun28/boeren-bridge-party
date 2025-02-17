import { PARTYKIT_URL } from "@/app/env";
import { RoomList } from "@/app/RoomList";

export const revalidate = 0;

export default async function Home() {
    console.log("Fetching rooms from:", `${PARTYKIT_URL}/party/lobby`);

    // Fetch initial rooms from server
    const res = await fetch(`${PARTYKIT_URL}/party/lobby`, {
        next: { revalidate: 0 },
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to fetch rooms:", {
            status: res.status,
            statusText: res.statusText,
            body: errorText,
        });
        return (
            <div>
                Error loading rooms: {res.status} {res.statusText}
            </div>
        );
    }

    const text = await res.text();
    console.log("Raw response:", text);

    const data = JSON.parse(text);
    console.log("Parsed data:", data);

    const initialRooms = data.type === "roomsUpdate" ? data.rooms : [];
    console.log("Initial rooms:", initialRooms);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <header className="bg-white dark:bg-gray-800 shadow-sm p-6">
                <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-white">Boeren Bridge</h1>
            </header>

            <main className="container mx-auto max-w-md p-4">
                <RoomList initialRooms={initialRooms} />
            </main>
        </div>
    );
}
