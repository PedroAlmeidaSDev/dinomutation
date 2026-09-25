/**
 * Per-dinosaur difficulty ladder. Only the first one starts unlocked; beating a
 * difficulty with a dinosaur unlocks the next one for that dinosaur.
 *
 * Multipliers stack on top of the normal scaling (RunDirector.scaling), so they
 * also carry over into the endless mode. "normal" is the reference game (×1).
 */
export type DifficultyId = 'filhote' | 'normal' | 'predador' | 'extincao';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  description: string;
  color: number;
  /** Normal enemies and the elite. */
  enemyHp: number;
  enemyDamage: number;
  /** Final boss. */
  bossHp: number;
  bossDamage: number;
  /** Multiplies the Fósseis earned in the run. */
  fossilMult: number;
  /** One-time Fósseis for the first win on this difficulty with each dinosaur. */
  firstWinBonus: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'filhote', name: 'Filhote', description: 'Para aprender. Inimigos e chefe bem mais fracos.', color: 0x8ad06a,
    enemyHp: 0.75, enemyDamage: 0.7, bossHp: 0.6, bossDamage: 0.55, fossilMult: 0.75, firstWinBonus: 60,
  },
  {
    id: 'normal', name: 'Normal', description: 'O desafio de verdade.', color: 0xe8c860,
    enemyHp: 1, enemyDamage: 1, bossHp: 1, bossDamage: 1, fossilMult: 1, firstWinBonus: 150,
  },
  {
    id: 'predador', name: 'Predador', description: 'Inimigos e chefe mais fortes. Mais Fósseis.', color: 0xff8a3a,
    enemyHp: 1.3, enemyDamage: 1.25, bossHp: 1.45, bossDamage: 1.35, fossilMult: 1.4, firstWinBonus: 250,
  },
  {
    id: 'extincao', name: 'Extinção', description: 'Só para os mais aptos. Muito mais Fósseis.', color: 0xff4a5a,
    enemyHp: 1.5, enemyDamage: 1.45, bossHp: 1.8, bossDamage: 1.6, fossilMult: 1.8, firstWinBonus: 400,
  },
];

export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d])) as Record<DifficultyId, DifficultyDef>;

export function difficultyIndex(id: DifficultyId): number {
  return DIFFICULTIES.findIndex((d) => d.id === id);
}

/** `cleared` = index of the highest difficulty beaten (-1 = none). Returns the highest unlocked index. */
export function highestUnlocked(cleared: number): number {
  return Math.min(DIFFICULTIES.length - 1, cleared + 1);
}
