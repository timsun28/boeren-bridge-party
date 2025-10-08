import type { Game, Player, Round } from "@/types/game";
import { generateTricksArray as deriveTricks } from "@/types/game";

export function calculateScore(predicted: number, actual: number): number {
    if (predicted === actual) {
        return 10 + actual;
    }
    return -Math.abs(predicted - actual);
}

export const generateTricksArray = deriveTricks;
