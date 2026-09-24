/**
 * Central tuning numbers. Prefer editing values here over hunting through systems.
 */
export const BALANCE = {
  world: { width: 3200, height: 3200, wallThickness: 60 },

  player: {
    /** Seconds of invulnerability after taking a hit. */
    iFrames: 0.28,
    basePickupRange: 125,
    /**
     * Diminishing returns on summed 'mult' bonuses: past `above`, the excess only counts at `rate`.
     * Keeps attack-speed stacking (Reflexos + Frenesi + Predador) from running away.
     */
    softCaps: { attackSpeed: { above: 1.0, rate: 0.5 } },
    /** Momentum builds while moving in a consistent direction (Massa Imparável). */
    momentumBuildTime: 1.8,
    momentumAngleTolerance: 0.45,
  },

  xp: {
    base: 4,
    perLevel: 3,
    exponent: 1.44,
  },

  upgrades: {
    rarityWeights: { common: 100, rare: 30, legendary: 5 },
    /** Extra rarity weight gained per player level. */
    rarityWeightPerLevel: { common: 0, rare: 1.2, legendary: 0.45 },
    /** Weight bonus per tag shared with owned upgrades. Soft nudge, never a guarantee. */
    affinityPerSharedTag: 0.18,
    affinityMax: 1.0,
    rerollsPerRun: 2,
    apexMultiplier: 1.5,
  },

  statuses: {
    bleed: { dpsPerStack: 1.6, damageScaling: 0.05, duration: 4, maxStacks: 30, tick: 0.5 },
    poison: { dpsPerStack: 2.2, damageScaling: 0.04, duration: 3, maxStacks: 20, tick: 0.5 },
    enemyPoisonOnPlayer: { dpsPerStack: 1.1, duration: 2.5, maxStacks: 4 },
    slow: { multiplier: 0.55 },
  },

  /** Normal enemies: hp × (1 + a·m + b·m²), damage × (1 + c·m), m = run minutes. */
  enemyScaling: {
    hpPerMinute: 0.26,
    hpPerMinuteSq: 0.02,
    damagePerMinute: 0.11,
  },

  combat: {
    armorConstant: 100,
    maxDamageReduction: 0.6,
    contactCooldown: 1.0,
    enemyArmorConstant: 100,
    hitFlashTime: 0.07,
  },

  drops: {
    meatChance: 0.006,
    magnetChance: 0.0025,
    meatHealPercent: 0.3,
    maxOrbs: 260,
  },

  feel: {
    hitstopCrit: 0.02,
    hitstopHeavy: 0.045,
    hitstopAbility: 0.07,
    shakeLight: 0.0025,
    shakeMedium: 0.006,
    shakeHeavy: 0.012,
    maxDamageNumbers: 70,
  },

  maxEnemies: 230,
  /** Enemies further than this from the player get recycled to the spawn ring. */
  recycleDistance: 1500,
};

export type Rarity = 'common' | 'rare' | 'legendary';

export function xpToNext(level: number): number {
  const { base, perLevel, exponent } = BALANCE.xp;
  return Math.floor(base + perLevel * Math.pow(level - 1, exponent));
}
