import type { EnemyId } from './enemies';

export interface SpawnPhase {
  /** Run time (seconds) at which this phase starts. */
  start: number;
  /** Seconds between spawn batches. */
  interval: number;
  batch: [number, number];
  /** Stop spawning above this many living enemies. */
  maxAlive: number;
  pool: Partial<Record<EnemyId, number>>;
}

export interface DirectorEvent {
  time: number;
  /** swarm: a pack from one direction. ring: enemies encircle the player. */
  type: 'swarm' | 'ring';
  enemy: EnemyId;
  count: number;
  banner?: string;
}

/**
 * Timeline of a run. All pacing lives here so it can be tuned without touching code.
 * Default run: elite at 6:00, boss at 9:00, ~10-11 min total.
 */
export const DIRECTOR_CONFIG = {
  eliteTime: 360,
  bossTime: 540,
  /** Seconds of warning before the elite/boss arrive. */
  warningTime: 6,
  spawnRing: { min: 740, max: 920 },
  phases: [
    { start: 0, interval: 1.1, batch: [1, 2], maxAlive: 22, pool: { compy: 1 } },
    { start: 40, interval: 0.95, batch: [2, 3], maxAlive: 40, pool: { compy: 4, wildRaptor: 0.6 } },
    { start: 110, interval: 0.9, batch: [2, 4], maxAlive: 60, pool: { compy: 4, wildRaptor: 2, dilophosaurus: 1.5 } },
    { start: 170, interval: 0.85, batch: [3, 4], maxAlive: 80, pool: { compy: 4, wildRaptor: 2, dilophosaurus: 1.5, pachy: 1.2, pterosaur: 1 } },
    { start: 240, interval: 0.75, batch: [3, 5], maxAlive: 105, pool: { compy: 4, wildRaptor: 2.5, dilophosaurus: 2, pachy: 1.5, pterosaur: 1.5, carnotaurus: 0.5 } },
    { start: 330, interval: 0.7, batch: [3, 5], maxAlive: 120, pool: { compy: 3, wildRaptor: 2, dilophosaurus: 1.5, pterosaur: 1 } },
    { start: 375, interval: 0.6, batch: [4, 6], maxAlive: 140, pool: { compy: 4, wildRaptor: 3, dilophosaurus: 2, pachy: 2, pterosaur: 2, carnotaurus: 1 } },
    { start: 450, interval: 0.5, batch: [5, 7], maxAlive: 175, pool: { compy: 5, wildRaptor: 3, dilophosaurus: 2.5, pachy: 2, pterosaur: 2, carnotaurus: 1.3 } },
    { start: 540, interval: 0.9, batch: [3, 4], maxAlive: 90, pool: { compy: 3, wildRaptor: 1, dilophosaurus: 1 } },
  ] as SpawnPhase[],
  events: [
    { time: 75, type: 'swarm', enemy: 'compy', count: 22, banner: 'Um bando de Compys!' },
    { time: 150, type: 'swarm', enemy: 'wildRaptor', count: 6, banner: 'Raptors caçando em grupo!' },
    { time: 225, type: 'ring', enemy: 'compy', count: 36, banner: 'Cercado!' },
    { time: 300, type: 'swarm', enemy: 'carnotaurus', count: 3, banner: 'Carnotaurus à vista' },
    { time: 420, type: 'ring', enemy: 'compy', count: 60, banner: 'A horda se fecha!' },
    { time: 480, type: 'swarm', enemy: 'pachy', count: 9, banner: 'Estouro de Pachys!' },
    { time: 515, type: 'ring', enemy: 'wildRaptor', count: 22, banner: 'A matilha selvagem!' },
  ] as DirectorEvent[],
};
