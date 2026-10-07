import data from '../../../shared/economy.json' with { type: 'json' };

/**
 * Economy numbers shared with the server (shared/economy.json): the API pays Fósseis and
 * mastery with the same values, so they live in one file both sides read. Names, colours
 * and effects stay in TS: only the game needs them.
 */
export interface EconomyDifficulty {
  id: string;
  fossilMult: number;
  firstWinBonus: number;
}

export interface EconomyShopItem {
  id: string;
  costs: number[];
}

export interface EconomyData {
  dinos: string[];
  fossils: { perMinute: number; perKills: number; elite: number; boss: number };
  mastery: { secondsPerXp: number; elite: number; boss: number; maxLevel: number; xpPerLevel: number };
  difficulties: EconomyDifficulty[];
  shop: Record<string, EconomyShopItem[]>;
}

export const ECONOMY: EconomyData = data;

export function difficultyEconomy(id: string): EconomyDifficulty {
  const d = ECONOMY.difficulties.find((x) => x.id === id);
  if (!d) throw new Error(`economy.json: a dificuldade "${id}" não existe`);
  return d;
}

/** Fossil cost of each level of a shop item; the item must be sold to `dino` in economy.json. */
export function itemCosts(dino: string, id: string): number[] {
  const item = ECONOMY.shop[dino]?.find((x) => x.id === id);
  if (!item) throw new Error(`economy.json: o item "${id}" não existe na loja de "${dino}"`);
  return item.costs;
}

/** Throws when the ids defined in TS and in economy.json diverge (checked at module load). */
export function assertSameIds(what: string, ts: readonly string[], json: readonly string[]): void {
  const a = ts.join(',');
  const b = json.join(',');
  if (a !== b) throw new Error(`economy.json: ${what} diverge do TS (TS: ${a} · JSON: ${b})`);
}
