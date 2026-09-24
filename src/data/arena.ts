export type ObstacleType = 'rock' | 'bigRock' | 'tree' | 'bones' | 'skull';

export interface ObstacleDef {
  type: ObstacleType;
  x: number;
  y: number;
  /** Collision radius. */
  r: number;
}

/**
 * Hand-built arena (3200×3200). The centre is left open for the start of the run;
 * rock clusters and groves create lanes to kite through.
 */
export const ARENA_OBSTACLES: ObstacleDef[] = [
  // Inner ring — light cover near spawn
  { type: 'rock', x: 1250, y: 1300, r: 30 },
  { type: 'bones', x: 1980, y: 1350, r: 22 },
  { type: 'tree', x: 1900, y: 1950, r: 26 },
  { type: 'rock', x: 1320, y: 1960, r: 34 },
  { type: 'skull', x: 1600, y: 1180, r: 26 },

  // North-west grove
  { type: 'tree', x: 700, y: 650, r: 28 },
  { type: 'tree', x: 820, y: 560, r: 26 },
  { type: 'tree', x: 600, y: 800, r: 30 },
  { type: 'tree', x: 900, y: 760, r: 24 },
  { type: 'tree', x: 480, y: 560, r: 28 },

  // North rock wall with gaps
  { type: 'bigRock', x: 1350, y: 520, r: 60 },
  { type: 'bigRock', x: 1560, y: 470, r: 56 },
  { type: 'rock', x: 1760, y: 540, r: 36 },
  { type: 'bigRock', x: 2000, y: 500, r: 62 },

  // North-east bone field
  { type: 'bones', x: 2500, y: 650, r: 24 },
  { type: 'skull', x: 2650, y: 800, r: 30 },
  { type: 'bones', x: 2380, y: 880, r: 22 },
  { type: 'rock', x: 2750, y: 560, r: 30 },
  { type: 'bones', x: 2820, y: 950, r: 22 },

  // East ridge
  { type: 'bigRock', x: 2700, y: 1450, r: 64 },
  { type: 'rock', x: 2820, y: 1620, r: 34 },
  { type: 'bigRock', x: 2600, y: 1780, r: 58 },
  { type: 'tree', x: 2950, y: 1300, r: 26 },

  // South-east grove
  { type: 'tree', x: 2400, y: 2450, r: 28 },
  { type: 'tree', x: 2550, y: 2380, r: 26 },
  { type: 'tree', x: 2480, y: 2600, r: 30 },
  { type: 'tree', x: 2700, y: 2550, r: 26 },
  { type: 'tree', x: 2650, y: 2750, r: 28 },

  // South rocks
  { type: 'bigRock', x: 1500, y: 2700, r: 60 },
  { type: 'rock', x: 1720, y: 2620, r: 34 },
  { type: 'rock', x: 1300, y: 2800, r: 32 },
  { type: 'bones', x: 1900, y: 2850, r: 24 },

  // South-west bones & rocks
  { type: 'skull', x: 650, y: 2500, r: 30 },
  { type: 'bones', x: 800, y: 2650, r: 22 },
  { type: 'rock', x: 520, y: 2700, r: 32 },
  { type: 'tree', x: 900, y: 2400, r: 26 },

  // West ridge
  { type: 'bigRock', x: 520, y: 1500, r: 62 },
  { type: 'rock', x: 420, y: 1700, r: 34 },
  { type: 'bigRock', x: 600, y: 1900, r: 56 },
  { type: 'tree', x: 300, y: 1300, r: 26 },

  // Mid scatter
  { type: 'tree', x: 1000, y: 1150, r: 26 },
  { type: 'rock', x: 2250, y: 1150, r: 30 },
  { type: 'tree', x: 2250, y: 2150, r: 26 },
  { type: 'bones', x: 1050, y: 2150, r: 22 },
  { type: 'rock', x: 1100, y: 1650, r: 28 },
  { type: 'tree', x: 2150, y: 1650, r: 26 },
];

/** Purely decorative ground details (no collision). */
export const ARENA_DECOR_COUNT = 260;
