import type { EffectDefinition } from '../game/upgrades/UpgradeTypes';
import type { DinoId } from './dinosaurs';

/**
 * Out-of-run progression. Two currencies:
 *  - Fósseis: global, earned by any dinosaur, spent in each dinosaur's shop (Covil).
 *  - Maestria: XP per dinosaur; its levels follow MASTERY_TRACK, unlocking and ranking up
 *    the dinosaur's passives and its special ability. It never gates the shop.
 *
 * Shop items, passives and ability ranks are applied at run start as hidden upgrades, so
 * they reuse the regular effect engine (stat / trigger / flag) and never show up on cards.
 */
export const META_ECONOMY = {
  fossils: { perMinute: 15, perKills: 60, elite: 40, boss: 120 },
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
}

export interface PassiveDef {
  id: string;
  name: string;
  description: string;
  /** What rank II does (ranks scale the effect through the upgrade `power`). */
  rank2: string;
  /** Effect power at rank I and II (default [1, 1.5]). */
  rankPower?: [number, number];
  effects: EffectDefinition[];
}

/** Rank-ups of the special ability: stat bonuses multiplied by the rank. */
export interface AbilityMasteryDef {
  id: string;
  description: string;
  effects: EffectDefinition[];
}

/** Five tiers per item: cheap first steps for a quick sense of progress, pricey late ones. */
const COSTS = [30, 70, 150, 300, 480];

const SHARED_ITEMS: ShopItemDef[] = [
  {
    id: 'meta_vida', name: 'Ossos Robustos', description: '+12% de vida máxima por nível.',
    effects: [{ type: 'stat', stat: 'maxHealth', mode: 'mult', value: 0.12 }], costs: COSTS,
  },
  {
    id: 'meta_dano', name: 'Músculos Ancestrais', description: '+12% de dano por nível.',
    effects: [{ type: 'stat', stat: 'damage', mode: 'mult', value: 0.12 }], costs: COSTS,
  },
  {
    id: 'meta_armadura', name: 'Couro Curtido', description: '+5 de armadura por nível.',
    effects: [{ type: 'stat', stat: 'armor', mode: 'add', value: 5 }], costs: COSTS,
  },
  {
    id: 'meta_genes', name: 'Genes Adaptativos', description: '+6% de DNA (XP) ganho por nível.',
    effects: [{ type: 'stat', stat: 'xpGain', mode: 'mult', value: 0.06 }], costs: COSTS,
  },
];

const SIGNATURE_ITEMS: Record<DinoId, ShopItemDef> = {
  trex: {
    id: 'meta_trex_crit', name: 'Mandíbula Ancestral', description: '+3% de chance de crítico por nível.',
    effects: [{ type: 'stat', stat: 'critChance', mode: 'add', value: 0.03 }], costs: COSTS,
  },
  raptor: {
    id: 'meta_raptor_claw', name: 'Garras Afiadas', description: '+8% de dano de garra por nível.',
    effects: [{ type: 'stat', stat: 'dmg_claw', mode: 'add', value: 0.08 }], costs: COSTS,
  },
  triceratops: {
    id: 'meta_tri_horn', name: 'Chifres Afiados', description: '+8% de dano de chifrada por nível.',
    effects: [{ type: 'stat', stat: 'dmg_horn', mode: 'add', value: 0.08 }], costs: COSTS,
  },
};

export const SHOP: Record<DinoId, ShopItemDef[]> = {
  trex: [...SHARED_ITEMS, SIGNATURE_ITEMS.trex],
  raptor: [...SHARED_ITEMS, SIGNATURE_ITEMS.raptor],
  triceratops: [...SHARED_ITEMS, SIGNATURE_ITEMS.triceratops],
};

/** Passives in unlock order (slot 0, 1, 2 of MASTERY_TRACK). */
export const PASSIVES: Record<DinoId, PassiveDef[]> = {
  trex: [
    {
      id: 'pas_trex_presas', name: 'Presas Ancestrais', rank2: 'Nível II: +12% de chance de crítico.',
      description: '+8% de chance de crítico contra inimigos abaixo de 50% de vida.',
      effects: [{ type: 'trigger', trigger: 'modifyDamage', effect: 'lowHpCrit', params: { threshold: 0.5, bonus: 0.08 } }],
    },
    {
      id: 'pas_trex_rugido', name: 'Rugido Intimidador', rank2: 'Nível II: amedronta por 1.8s.',
      description: 'Usar a habilidade amedronta inimigos próximos por 1.2s.',
      effects: [{ type: 'trigger', trigger: 'onAbilityUse', effect: 'fearPulse', params: { radius: 220, duration: 1.2 } }],
    },
    {
      id: 'pas_trex_tirano', name: 'Rei Tirano', rank2: 'Nível II: +30% de dano; executa abaixo de 4.5%.',
      description: '+20% de dano contra inimigos abaixo de 25% de vida; executa os abaixo de 3%.',
      effects: [{ type: 'trigger', trigger: 'modifyDamage', effect: 'execute', params: { threshold: 0.25, bonus: 0.2, instakill: 0.03 } }],
    },
  ],
  raptor: [
    {
      id: 'pas_raptor_caca', name: 'Instinto de Caça', rank2: 'Nível II: +3% de movimento por abate.',
      description: 'Abates dão +2% de movimento por 3s (acumula até 5×).',
      effects: [
        { type: 'trigger', trigger: 'onKill', effect: 'stackBuff', params: { stat: 'moveSpeed', perStack: 0.02, max: 5, duration: 3 } },
        { type: 'trigger', trigger: 'tick', effect: 'stackDecay' },
      ],
    },
    {
      id: 'pas_raptor_reflexo', name: 'Reflexo Felino', rank2: 'Nível II: +30% de movimento e de velocidade de ataque.',
      description: 'Abaixo de 35% de vida: +20% de movimento e de velocidade de ataque.',
      effects: [{ type: 'trigger', trigger: 'tick', effect: 'lowHpBuff', params: { threshold: 0.35, moveSpeed: 0.2, attackSpeed: 0.2 } }],
    },
    {
      id: 'pas_raptor_alfa', name: 'Alfa da Matilha', rank2: 'Nível II: surgem 2 raptores espectrais.', rankPower: [1, 2],
      description: 'A cada 9s, um raptor espectral surge e ataca ao seu lado.',
      effects: [{ type: 'trigger', trigger: 'tick', effect: 'summonGhosts', params: { interval: 9, coef: 1.2 } }],
    },
  ],
  triceratops: [
    {
      id: 'pas_tri_couraca', name: 'Couraça Viva', rank2: 'Nível II: +12% de redução de dano.',
      description: 'Ao sofrer dano, ganha +8% de redução de dano por 2s.',
      effects: [{ type: 'trigger', trigger: 'onDamageTaken', effect: 'timedStat', params: { stat: 'damageReduction', mode: 'add', value: 0.08, duration: 2 } }],
    },
    {
      id: 'pas_tri_espinhos', name: 'Espinhos Dorsais', rank2: 'Nível II: devolve 50% a mais de dano.',
      description: 'Devolve dano a quem te ataca corpo a corpo (6 + 30% da armadura).',
      effects: [{ type: 'trigger', trigger: 'onDamageTaken', effect: 'thorns', params: { flat: 6, armorScale: 0.3 } }],
    },
    {
      id: 'pas_tri_tremor', name: 'Tremor', rank2: 'Nível II: onda 50% mais forte e maior.',
      description: 'Usar a habilidade libera uma onda de choque que atordoa em volta.',
      effects: [{
        type: 'trigger', trigger: 'onAbilityUse', effect: 'aoeBurst',
        params: { radius: 170, coef: 1.2, stun: 0.8, knockback: 200, color: 0xffc070, tag: 'impact' },
      }],
    },
  ],
};

/** Each rank: +15% ability damage and +5% cooldown reduction (dmg_<tag> only hits the ability). */
const abilityRank = (id: string, tag: string): AbilityMasteryDef => ({
  id,
  description: '+15% de dano e 5% menos recarga da habilidade por nível.',
  effects: [
    { type: 'stat', stat: `dmg_${tag}`, mode: 'add', value: 0.15 },
    { type: 'stat', stat: 'cooldownReduction', mode: 'add', value: 0.05 },
  ],
});

export const ABILITY_MASTERY: Record<DinoId, AbilityMasteryDef> = {
  trex: abilityRank('hab_trex', 'roar'),
  raptor: abilityRank('hab_raptor', 'pounce'),
  triceratops: abilityRank('hab_tri', 'charge'),
};
export const ABILITY_MAX_RANK = 3;

export type MasteryStep =
  | { level: number; kind: 'passive'; slot: number; rank: 1 | 2 }
  | { level: number; kind: 'ability'; rank: number };

/** What each mastery level unlocks (the same for every dinosaur). */
export const MASTERY_TRACK: MasteryStep[] = [
  { level: 2, kind: 'passive', slot: 0, rank: 1 },
  { level: 3, kind: 'ability', rank: 1 },
  { level: 4, kind: 'passive', slot: 1, rank: 1 },
  { level: 5, kind: 'passive', slot: 0, rank: 2 },
  { level: 6, kind: 'ability', rank: 2 },
  { level: 7, kind: 'passive', slot: 2, rank: 1 },
  { level: 8, kind: 'passive', slot: 1, rank: 2 },
  { level: 9, kind: 'ability', rank: 3 },
  { level: 10, kind: 'passive', slot: 2, rank: 2 },
];

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

/** Rank (0 = locked) of passive `slot` at a mastery level. */
export function passiveRank(slot: number, mastery: number): number {
  let rank = 0;
  for (const s of MASTERY_TRACK) if (s.kind === 'passive' && s.slot === slot && s.level <= mastery) rank = s.rank;
  return rank;
}

/** Rank (0 = none) of the special ability at a mastery level. */
export function abilityMasteryRank(mastery: number): number {
  let rank = 0;
  for (const s of MASTERY_TRACK) if (s.kind === 'ability' && s.level <= mastery) rank = s.rank;
  return rank;
}

/** Mastery level at which a passive slot / the ability reaches a rank. */
export function masteryFor(kind: 'passive' | 'ability', rank: number, slot = 0): number {
  const s = MASTERY_TRACK.find((x) => x.kind === kind && x.rank === rank && (x.kind === 'ability' || x.slot === slot));
  return s?.level ?? Infinity;
}

export interface RunRewardInput {
  elapsedTime: number;
  kills: number;
  eliteKilled: boolean;
  bossKilled: boolean;
  /** Difficulty multiplier on Fósseis (data/difficulty.ts). */
  fossilMult?: number;
}

export function fossilsForRun(r: RunRewardInput): number {
  const f = META_ECONOMY.fossils;
  const base = (r.elapsedTime / 60) * f.perMinute
    + Math.floor(r.kills / f.perKills)
    + (r.eliteKilled ? f.elite : 0)
    + (r.bossKilled ? f.boss : 0);
  return Math.floor(base * (r.fossilMult ?? 1));
}

export function masteryXpForRun(r: RunRewardInput): number {
  const m = META_ECONOMY.mastery;
  return Math.floor(r.elapsedTime / m.secondsPerXp) + (r.eliteKilled ? m.elite : 0) + (r.bossKilled ? m.boss : 0);
}

/** Hidden upgrades applied at run start: purchased shop levels, passive ranks and ability ranks. */
export interface MetaBonus {
  id: string;
  /** Effect power (shop level, passive rank power or ability rank). */
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
  PASSIVES[dino].forEach((p, slot) => {
    const rank = passiveRank(slot, mastery);
    if (rank > 0) out.push({ id: p.id, level: (p.rankPower ?? [1, 1.5])[rank - 1], effects: p.effects });
  });
  const ab = ABILITY_MASTERY[dino];
  const abRank = abilityMasteryRank(mastery);
  if (abRank > 0) out.push({ id: ab.id, level: abRank, effects: ab.effects });
  return out;
}

/** Everything unlocked by reaching exactly `level` (for the "level up!" message). */
export function unlocksAtMastery(dino: DinoId, level: number): string[] {
  const out: string[] = [];
  for (const s of MASTERY_TRACK) {
    if (s.level !== level) continue;
    if (s.kind === 'ability') out.push(`Habilidade nível ${roman(s.rank)}`);
    else out.push(`Passiva: ${PASSIVES[dino][s.slot].name}${s.rank > 1 ? ` ${roman(s.rank)}` : ''}`);
  }
  return out;
}

export function roman(n: number): string {
  return ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n);
}
