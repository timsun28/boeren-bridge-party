export interface Game {
    id: string;
    name: string;
    players: Player[];
    createdAt: number;
    currentRound: number;
    rounds: Round[];
    roundConfirmations: { [key: number]: string[] };
    status: "predicting" | "playing" | "confirming" | "completed";
    started: boolean;
    totalRounds: number;
    tricksPerRound: number[];
    currentTricks: number;
    predictedTricksSum: number;
}

export type Player = {
    id: string;
    name: string;
    score: number;
    joinedAt: number;
    predictedTricks?: number;
    actualTricks?: number;
    tempPrediction?: number;
};

export type Round = {
    roundNumber: number;
    predictions: { [playerId: string]: number };
    actual: { [playerId: string]: number };
    scores: { [playerId: string]: number };
    completed: boolean;
};

export function generateTricksArray(maxRounds: number): number[] {
    // Going up (1 to maxRounds)
    const ascending = Array.from({ length: maxRounds }, (_, i) => i + 1);
    // maxRounds again (for the middle no-trump round)
    const middle = [maxRounds];
    // Going down (maxRounds-1 to 1)
    const descending = Array.from({ length: maxRounds - 1 }, (_, i) => maxRounds - 1 - i);

    return [...ascending, ...middle, ...descending];
}
