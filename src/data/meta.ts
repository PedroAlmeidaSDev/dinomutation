import type { EffectDefinition } from '../game/upgrades/UpgradeTypes';
import type { DinoId } from './dinosaurs';

/**
 * Out-of-run progression. Two currencies:
 *  - Fósseis: global, earned by any dinosaur, spent in each dinosaur's shop (Covil).
 *  - Maestria: XP per dinosaur; its level gates shop tiers and unlocks free passives.
 *
 * Shop items and passives are applied at run start as hidden upgrades, so they reuse
 * the regular effect engine (stat / trigger / flag) and never show up on cards.
 */
export const META_ECONOMY = {
  fossils: { perMinute: 10, perKills: 100, elite: 30, boss: 120 },
  mastery: { secondsPerXp: 4, elite: 40, boss: 100, maxLevel: 10, xpPerLevel: 100 },
};

export interface ShopItemDef {
  id: string;
  name: string;
  /** Per-level effect; values are multiplied by the purchased level. */
  description: string;
  effects: EffectDefinition[];
  /** Fossil cost of each level (index 0 = level 1). */
  costs: number[];
  /** Mastery level required to buy each level. */
  mastery: number[];
}

export interface PassiveDef {
  id: string;
  name: string;
  description: string;
  /** Mastery level that unlocks it (free, always active). */
  mastery: number;
  effects: EffectDefinition[];
}

/** Five tiers per item: cheap early steps, mastery-gated late ones. */
const COSTS = [50, 120, 220, 360, 520];
const GATES = [1, 2, 4, 6, 8];

const SHARED_ITEMS: ShopItemDef[] = [
  {
    id: 'meta_vida', name: 'Ossos Robustos', description: '+12% de vida máxima por nível.',
    effects: [{ type: 'stat', stat: 'maxHealth', mode: 'mult', value: 0.12 }], costs: COSTS, mastery: GATES,
  },
  {
    id: 'meta_dano', name: 'Músculos Ancestrais', description: '+12% de dano por nível.',
    effects: [{ type: 'stat', stat: 'damage', mode: 'mult', value: 0.12 }], costs: COSTS, mastery: GATES,
  },
  {
    id: 'meta_armadura', name: 'Couro Curtido', description: '+5 de armadura por nível.',
    effects: [{ type: 'stat', stat: 'armor', mode: 'add', value: 5 }], costs: COSTS, mastery: GATES,
  },
  {
    id: 'meta_genes', name: 'Genes Adaptativos', description: '+6% de DNA (XP) ganho por nível.',
    effects: [{ type: 'stat', stat: 'xpGain', mode: 'mult', value: 0.06 }], costs: COSTS, mastery: GATES,
  },
];

const SIGNATURE_ITEMS: Record<DinoId, ShopItemDef> = {
  trex: {
    id: 'meta_trex_crit', name: 'Mandíbula Ancestral', description: '+3% de chance de crítico por nível.',
    effects: [{ type: 'stat', stat: 'critChance', mode: 'add', value: 0.03 }], costs: COSTS, mastery: GATES,
  },
  raptor: {
    id: 'meta_raptor_claw', name: 'Garras Afiadas', description: '+8% de dano de garra por nível.',
    effects: [{ type: 'stat', stat: 'dmg_claw', mode: 'add', value: 0.08 }], costs: COSTS, mastery: GATES,
  },
  triceratops: {
    id: 'meta_tri_horn', name: 'Chifres Afiados', description: '+8% de dano de chifrada por nível.',
    effects: [{ type: 'stat', stat: 'dmg_horn', mode: 'add', value: 0.08 }], costs: COSTS, mastery: GATES,
  },
};

export const SHOP: Record<DinoId, ShopItemDef[]> = {
  trex: [...SHARED_ITEMS, SIGNATURE_ITEMS.trex],
  raptor: [...SHARED_ITEMS, SIGNATURE_ITEMS.raptor],
  triceratops: [...SHARED_ITEMS, SIGNATURE_ITEMS.triceratops],
};

export const PASSIVES: Record<DinoId, PassiveDef[]> = {
  trex: [
    {
      id: 'pas_trex_presas', name: 'Presas Ancestrais', mastery: 2,
      description: '+8% de chance de crítico contra inimigos abaixo de 50% de vida.',
      effects: [{ type: 'trigger', trigger: 'modifyDamage', effect: 'lowHpCrit', params: { threshold: 0.5, bonus: 0.08 } }],
    },
    {
      id: 'pas_trex_rugido', name: 'Rugido Intimidador', mastery: 5,
      description: 'Usar a habilidade amedronta inimigos próximos por 1.2s.',
      effects: [{ type: 'trigger', trigger: 'onAbilityUse', effect: 'fearPulse', params: { radius: 220, duration: 1.2 } }],
    },
    {
      id: 'pas_trex_tirano', name: 'Rei Tirano', mastery: 8,
      description: '+20% de dano contra inimigos abaixo de 25% de vida; executa os abaixo de 3%.',
      effects: [{ type: 'trigger', trigger: 'modifyDamage', effect: 'execute', params: { threshold: 0.25, bonus: 0.2, instakill: 0.03 } }],
    },
  ],
  raptor: [
    {
      id: 'pas_raptor_caca', name: 'Instinto de Caça', mastery: 2,
      description: 'Abates dão +2% de movimento por 3s (acumula até 5×).',
      effects: [
        { type: 'trigger', trigger: 'onKill', effect: 'stackBuff', params: { stat: 'moveSpeed', perStack: 0.02, max: 5, duration: 3 } },
        { type: 'trigger', trigger: 'tick', effect: 'stackDecay' },
      ],
    },
    {
      id: 'pas_raptor_reflexo', name: 'Reflexo Felino', mastery: 5,
      description: 'Abaixo de 35% de vida: +20% de movimento e de velocidade de ataque.',
      effects: [{ type: 'trigger', trigger: 'tick', effect: 'lowHpBuff', params: { threshold: 0.35, moveSpeed: 0.2, attackSpeed: 0.2 } }],
    },
    {
      id: 'pas_raptor_alfa', name: 'Alfa da Matilha', mastery: 8,
      description: 'A cada 9s, um raptor espectral surge e ataca ao seu lado.',
      effects: [{ type: 'trigger', trigger: 'tick', effect: 'summonGhosts', params: { interval: 9, coef: 1.2 } }],
    },
  ],
  triceratops: [
    {
      id: 'pas_tri_couraca', name: 'Couraça Viva', mastery: 2,
      description: 'Ao sofrer dano, ganha +8% de redução de dano por 2s.',
      effects: [{ type: 'trigger', trigger: 'onDamageTaken', effect: 'timedStat', params: { stat: 'damageReduction', mode: 'add', value: 0.08, duration: 2 } }],
    },
    {
      id: 'pas_tri_espinhos', name: 'Espinhos Dorsais', mastery: 5,
      description: 'Devolve dano a quem te ataca corpo a corpo (6 + 30% da armadura).',
      effects: [{ type: 'trigger', trigger: 'onDamageTaken', effect: 'thorns', params: { flat: 6, armorScale: 0.3 } }],
    },
    {
      id: 'pas_tri_tremor', name: 'Tremor', mastery: 8,
      description: 'Usar a habilidade libera uma onda de choque que atordoa em volta.',
      effects: [{
        type: 'trigger', trigger: 'onAbilityUse', effect: 'aoeBurst',
        params: { radius: 170, coef: 1.2, stun: 0.8, knockback: 200, color: 0xffc070, tag: 'impact' },
      }],
    },
  ],
};

// ─────────────────────────── helpers ───────────────────────────

/** Mastery level (1..max) for a total amount of mastery XP. */
export function masteryLevel(xp: number): number {
  const { maxLevel, xpPerLevel } = META_ECONOMY.mastery;
  let level = 1;
  let need = xpPerLevel;
  let left = xp;
  while (level < maxLevel && left >= need) {
    left -= need;
    level++;
    need = xpPerLevel * level;
  }
  return level;
}

/** Progress inside the current mastery level: { into, needed } (needed = 0 at max level). */
export function masteryProgress(xp: number): { level: number; into: number; needed: number } {
  const { maxLevel, xpPerLevel } = META_ECONOMY.mastery;
  const level = masteryLevel(xp);
  let spent = 0;
  for (let l = 1; l < level; l++) spent += xpPerLevel * l;
  return { level, into: xp - spent, needed: level >= maxLevel ? 0 : xpPerLevel * level };
}

export interface RunRewardInput {
  elapsedTime: number;
  kills: number;
  eliteKilled: boolean;
  bossKilled: boolean;
}

export function fossilsForRun(r: RunRewardInput): number {
  const f = META_ECONOMY.fossils;
  return Math.floor((r.elapsedTime / 60) * f.perMinute)
    + Math.floor(r.kills / f.perKills)
    + (r.eliteKilled ? f.elite : 0)
    + (r.bossKilled ? f.boss : 0);
}

export function masteryXpForRun(r: RunRewardInput): number {
  const m = META_ECONOMY.mastery;
  return Math.floor(r.elapsedTime / m.secondsPerXp) + (r.eliteKilled ? m.elite : 0) + (r.bossKilled ? m.boss : 0);
}

/** Hidden upgrades applied at run start: purchased shop levels + unlocked passives. */
export interface MetaBonus {
  id: string;
  level: number;
  effects: EffectDefinition[];
}

export function loadoutFor(dino: DinoId, shopLevels: Record<string, number>, masteryXp: number): MetaBonus[] {
  const out: MetaBonus[] = [];
  for (const item of SHOP[dino]) {
    const level = shopLevels[item.id] ?? 0;
    if (level > 0) out.push({ id: item.id, level, effects: item.effects });
  }
  const mastery = masteryLevel(masteryXp);
  for (const p of PASSIVES[dino]) {
    if (mastery >= p.mastery) out.push({ id: p.id, level: 1, effects: p.effects });
  }
  return out;
}

/** Everything unlocked by reaching exactly `level` (for the "level up!" message). */
export function unlocksAtMastery(dino: DinoId, level: number): string[] {
  const out: string[] = [];
  for (const p of PASSIVES[dino]) if (p.mastery === level) out.push(`Passiva: ${p.name}`);
  for (const item of SHOP[dino]) {
    const tier = item.mastery.indexOf(level);
    if (tier >= 0) out.push(`Loja: ${item.name} ${tier + 1}`);
  }
  return out;
}
