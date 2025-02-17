import type { Game, Player, Round } from "@/types/game";

export function calculateScore(predicted: number, actual: number): number {
    if (predicted === actual) {
        return 10 + actual;
    }
    return -Math.abs(predicted - actual);
}

export function generateTricksArray(maxRounds: number): number[] {
    const array = [];
    for (let i = 1; i <= maxRounds; i++) array.push(i);
    for (let i = maxRounds; i >= 1; i--) array.push(i);
    return array;
} 