export type EnemyId =
  | 'compy'
  | 'dilophosaurus'
  | 'pachy'
  | 'wildRaptor'
  | 'pterosaur'
  | 'carnotaurus'
  | 'carnoAlpha'
  | 'giganotosaurus';

export type EnemyRank = 'normal' | 'elite' | 'boss';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  texture: string;
  behavior: EnemyId;
  rank: EnemyRank;
  hp: number;
  speed: number;
  contactDamage: number;
  armor: number;
  radius: number;
  xp: number;
  /** Knockback resistance, 0 = weightless, 1 = immovable. */
  mass: number;
  flying?: boolean;
  /** Visual scale over the base texture. */
  scale?: number;
  /** Behaviour-specific tuning. */
  params: Record<string, number>;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  compy: {
    id: 'compy', name: 'Compy', texture: 'en_compy', behavior: 'compy', rank: 'normal',
    hp: 12, speed: 118, contactDamage: 4, armor: 0, radius: 9, xp: 1, mass: 0,
    params: { wobble: 0.6 },
  },
  wildRaptor: {
    id: 'wildRaptor', name: 'Raptor Selvagem', texture: 'en_raptor', behavior: 'wildRaptor', rank: 'normal',
    hp: 34, speed: 172, contactDamage: 7, armor: 0, radius: 13, xp: 3, mass: 0.1,
    params: { flankDistance: 150, lungeRange: 175, lungeSpeed: 500, lungeTime: 0.32, windup: 0.4, cooldown: 2.0, lungeDamage: 7 },
  },
  dilophosaurus: {
    id: 'dilophosaurus', name: 'Dilophosaurus', texture: 'en_dilo', behavior: 'dilophosaurus', rank: 'normal',
    hp: 36, speed: 88, contactDamage: 6, armor: 0, radius: 14, xp: 4, mass: 0.1,
    params: { minRange: 200, maxRange: 330, fireInterval: 3.4, windup: 0.5, projectileSpeed: 240, damage: 5, poisonStacks: 1 },
  },
  pachy: {
    id: 'pachy', name: 'Pachycephalosaurus', texture: 'en_pachy', behavior: 'pachy', rank: 'normal',
    hp: 60, speed: 92, contactDamage: 8, armor: 10, radius: 16, xp: 5, mass: 0.35,
    params: { triggerRange: 320, windup: 0.85, chargeSpeed: 560, chargeTime: 0.6, damage: 17, recover: 1.3 },
  },
  pterosaur: {
    id: 'pterosaur', name: 'Pterossauro', texture: 'en_ptero', behavior: 'pterosaur', rank: 'normal',
    hp: 28, speed: 210, contactDamage: 0, armor: 0, radius: 14, xp: 4, mass: 0, flying: true,
    params: { orbitMin: 230, orbitMax: 320, hover: 0.65, projectileSpeed: 280, damage: 6, shots: 1 },
  },
  carnotaurus: {
    id: 'carnotaurus', name: 'Carnotaurus', texture: 'en_carno', behavior: 'carnotaurus', rank: 'normal',
    hp: 190, speed: 74, contactDamage: 12, armor: 15, radius: 26, xp: 14, mass: 0.7,
    params: { attackRange: 120, windup: 0.75, arc: 1.4, reach: 140, damage: 26, cooldown: 1.6 },
  },
  carnoAlpha: {
    id: 'carnoAlpha', name: 'Carnotaurus Alfa', texture: 'en_carno', behavior: 'carnoAlpha', rank: 'elite',
    hp: 4200, speed: 92, contactDamage: 18, armor: 20, radius: 42, xp: 90, mass: 0.92, scale: 1.65,
    params: {
      attackRange: 170, windup: 0.7, arc: 1.7, reach: 210, damage: 40, cooldown: 1.1,
      chargeWindup: 0.9, chargeSpeed: 640, chargeTime: 0.75, chargeDamage: 43,
      shockRadius: 210, shockWindup: 0.8, shockDamage: 33,
    },
  },
  giganotosaurus: {
    id: 'giganotosaurus', name: 'Giganotosaurus', texture: 'en_giga', behavior: 'giganotosaurus', rank: 'boss',
    hp: 24000, speed: 96, contactDamage: 24, armor: 35, radius: 58, xp: 0, mass: 1, scale: 1,
    params: {
      biteRange: 230, biteArc: 1.5, biteDamage: 52, biteWindup: 0.65,
      chargeWindup: 0.9, chargeSpeed: 760, chargeTime: 0.85, chargeDamage: 56,
      roarRadius: 320, roarWindup: 0.85, roarDamage: 24, roarForce: 900,
      stompRadius: 95, stompWindup: 1.0, stompDamage: 42, stompCount: 3,
      summonCount: 8, attackCooldown: 1.0,
      /** Share of the player's damage reduction ignored by telegraphed attacks. */
      pierce: 0.35,
      /** Seconds into the fight before the boss enrages (damage ×enrageDamage, windups ×enrageWindup). */
      enrageTime: 150, enrageDamage: 1.5, enrageWindup: 0.8,
    },
  },
};

/** Normal enemies (used by the spawn tables). */
export const NORMAL_ENEMIES: EnemyId[] = ['compy', 'wildRaptor', 'dilophosaurus', 'pachy', 'pterosaur', 'carnotaurus'];
