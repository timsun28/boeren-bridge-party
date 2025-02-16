import Image from "next/image";

export default function Home() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white">Boeren bridge scores</h1>
            <button className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium shadow-lg hover:bg-blue-700 transition-colors duration-200 transform hover:scale-105">
                Create room
            </button>
        </div>
    );
}
