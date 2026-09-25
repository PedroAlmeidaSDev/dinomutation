import type { EnemyId } from './enemies';

export type EraMutationId = 'thickSkin' | 'drought' | 'swarm' | 'feral' | 'meteors';

export interface EraMutation {
  id: EraMutationId;
  name: string;
  description: string;
}

/** Cumulative world modifiers, one added per Era from `mutationFromEra` on. */
export const ERA_MUTATIONS: Record<EraMutationId, EraMutation> = {
  thickSkin: { id: 'thickSkin', name: 'Pele Grossa', description: 'Todos os inimigos têm +20 de armadura' },
  drought: { id: 'drought', name: 'Seca', description: 'Carne não cai mais dos inimigos' },
  swarm: { id: 'swarm', name: 'Enxame', description: 'Inimigos surgem 35% mais rápido' },
  feral: { id: 'feral', name: 'Frenesi Selvagem', description: 'Inimigos são 20% mais rápidos' },
  meteors: { id: 'meteors', name: 'Chuva de Meteoros', description: 'Meteoros caem perto de você' },
};

export interface EndlessPhase {
  /** Seconds into the Era. */
  start: number;
  interval: number;
  batch: [number, number];
  maxAlive: number;
}

/**
 * "Era Sem Fim": optional endless mode after the Giganotosaurus falls.
 * Each Era: horde → event → elites → Giganotosaurus. Killing it starts the next Era.
 */
export const ENDLESS_CONFIG = {
  eraLength: 180,
  /** Quiet seconds after choosing to continue, and between Eras. */
  calmTime: 10,
  eraCalmTime: 6,
  /** Growth per Era (continuous within an Era for normal enemies). */
  hpPerEra: 1.35,
  damagePerEra: 1.15,
  speedPerEra: 0.03,
  speedMax: 0.3,
  /** Spawn interval multiplier per Era (floored at `minIntervalMult`). */
  intervalPerEra: 0.93,
  minIntervalMult: 0.5,
  phases: [
    { start: 0, interval: 0.6, batch: [4, 6], maxAlive: 150 },
    { start: 90, interval: 0.5, batch: [5, 7], maxAlive: 190 },
    { start: 150, interval: 0.45, batch: [5, 8], maxAlive: 210 },
  ] as EndlessPhase[],
  eventTime: 90,
  eliteTime: 120,
  warningTime: 6,
  /** Carnotaurus Alfas per Era: 1 + floor(era / 2), capped. */
  maxElites: 3,
  mutationFromEra: 3,
  meteor: { interval: 2.2, radius: 90, windup: 1.1, damage: 22 },
  /** Normal enemies eligible for the random Era pool (compy always heavy). */
  pool: ['compy', 'wildRaptor', 'dilophosaurus', 'pachy', 'pterosaur', 'carnotaurus'] as EnemyId[],
};
