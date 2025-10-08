export interface Player {
    id: string;
    name: string;
    score: number;
    joinedAt: number;
}

export interface Game {
    id: string;
    name: string;
    players: Player[];
    started: boolean;
    createdAt: number;
}

export type GameUpdate = {
    type: "roomsUpdate" | "gameUpdate";
    rooms: Game[];
};

export type GameAction =
    | { type: "createGame"; name: string }
    | { type: "joinGame"; gameId: string; player: Player }
    | { type: "leaveGame"; gameId: string; playerId: string }
    | { type: "startGame"; gameId: string }
    | { type: "predictTricks"; gameId: string; playerId: string; prediction: number }
    | { type: "playTrick"; gameId: string; playerId: string; card: number };
