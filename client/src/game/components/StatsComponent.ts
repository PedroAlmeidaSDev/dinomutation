/**
 * Centralised attribute system. Every change to a stat goes through a named modifier,
 * so upgrades, buffs and conditional effects never write raw values.
 *
 * final = (base + Σadd) × (1 + Σmult)
 *
 * Tag damage bonuses are stored as `dmg_<tag>` stats (e.g. dmg_bite = 0.3 → +30% for bite attacks).
 */
export type StatKey =
  | 'maxHealth'
  | 'damage'
  | 'attackSpeed'
  | 'moveSpeed'
  | 'armor'
  | 'critChance'
  | 'critDamage'
  | 'attackRange'
  | 'attackArc'
  | 'cooldownReduction'
  | 'size'
  | 'regen'
  | 'pickupRange'
  | 'xpGain'
  | 'damageReduction'
  | 'repeatChance'
  | 'bleedDamage'
  | 'poisonDamage'
  | 'knockback'
  | 'extraTargets'
  | 'summonDamage'
  | `dmg_${string}`;

export type ModMode = 'add' | 'mult';

export const STAT_DEFAULTS: Partial<Record<StatKey, number>> = {
  maxHealth: 100,
  damage: 10,
  attackSpeed: 1,
  moveSpeed: 150,
  armor: 0,
  critChance: 0.05,
  critDamage: 1.5,
  attackRange: 70,
  attackArc: 1.8,
  cooldownReduction: 0,
  size: 1,
  regen: 0,
  pickupRange: 95,
  xpGain: 1,
  damageReduction: 0,
  repeatChance: 0,
  bleedDamage: 1,
  poisonDamage: 1,
  knockback: 1,
  extraTargets: 0,
  summonDamage: 1,
};

export const STAT_LABELS: Partial<Record<StatKey, string>> = {
  maxHealth: 'Vida Máx.',
  damage: 'Dano',
  attackSpeed: 'Vel. Ataque',
  moveSpeed: 'Movimento',
  armor: 'Armadura',
  critChance: 'Crítico',
  critDamage: 'Dano Crítico',
  attackRange: 'Alcance',
  cooldownReduction: 'Red. Recarga',
  size: 'Tamanho',
  regen: 'Regeneração',
  damageReduction: 'Red. Dano',
  repeatChance: 'Repetir Ataque',
  attackArc: 'Arco',
  pickupRange: 'Coleta',
  xpGain: 'Ganho de DNA',
  bleedDamage: 'Dano Sangram.',
  poisonDamage: 'Dano Veneno',
  knockback: 'Empurrão',
  extraTargets: 'Alvos Extras',
  summonDamage: 'Dano Invocação',
};

export interface StatMod {
  stat: StatKey;
  mode: ModMode;
  value: number;
}

interface Modifier extends StatMod {
  /** Remaining seconds, or Infinity for permanent modifiers. */
  remaining: number;
}

/** Past `above`, the summed mult bonus only counts at `rate` (diminishing returns). */
export interface SoftCap {
  above: number;
  rate: number;
}

export class StatsComponent {
  private readonly base: Partial<Record<StatKey, number>>;
  private readonly softCaps: Partial<Record<StatKey, SoftCap>>;
  private readonly mods = new Map<string, Modifier>();
  private cache = new Map<StatKey, number>();
  /** Called after any change; used e.g. to keep current HP in sync with max HP. */
  onChange?: () => void;

  constructor(base: Partial<Record<StatKey, number>>, softCaps: Partial<Record<StatKey, SoftCap>> = {}) {
    this.base = { ...base };
    this.softCaps = softCaps;
  }

  get(stat: StatKey): number {
    const cached = this.cache.get(stat);
    if (cached !== undefined) return cached;
    const v = this.compute(stat, this.mods.values());
    this.cache.set(stat, v);
    return v;
  }

  /**
   * Value of `stat` with `overrides` (id → modifier) applied, without changing anything.
   * Only permanent modifiers whose id passes `keep` count, so momentary buffs can be left out
   * (the upgrade cards use this to show "before → after").
   */
  preview(stat: StatKey, overrides: Record<string, StatMod>, keep: (id: string) => boolean = () => true): number {
    const mods: StatMod[] = [];
    for (const [id, m] of this.mods) if (m.remaining === Infinity && keep(id) && !(id in overrides)) mods.push(m);
    mods.push(...Object.values(overrides));
    return this.compute(stat, mods);
  }

  private compute(stat: StatKey, mods: Iterable<StatMod>): number {
    let add = 0;
    let mult = 0;
    for (const m of mods) {
      if (m.stat !== stat) continue;
      if (m.mode === 'add') add += m.value;
      else mult += m.value;
    }
    const cap = this.softCaps[stat];
    if (cap && mult > cap.above) mult = cap.above + (mult - cap.above) * cap.rate;
    const base = this.base[stat] ?? STAT_DEFAULTS[stat] ?? 0;
    return (base + add) * (1 + mult);
  }

  getBase(stat: StatKey): number {
    return this.base[stat] ?? STAT_DEFAULTS[stat] ?? 0;
  }

  /** Sum of `dmg_<tag>` bonuses for a set of attack tags. */
  tagDamageBonus(tags: readonly string[]): number {
    let sum = 0;
    for (const t of tags) sum += this.get(`dmg_${t}`);
    return sum;
  }

  /** Create or overwrite a permanent modifier. */
  setModifier(id: string, stat: StatKey, mode: ModMode, value: number): void {
    const existing = this.mods.get(id);
    if (existing && existing.stat === stat && existing.mode === mode && existing.value === value && existing.remaining === Infinity) return;
    this.mods.set(id, { stat, mode, value, remaining: Infinity });
    this.invalidate();
  }

  /** Create or refresh a temporary modifier. */
  addTimed(id: string, stat: StatKey, mode: ModMode, value: number, duration: number): void {
    this.mods.set(id, { stat, mode, value, remaining: duration });
    this.invalidate();
  }

  hasModifier(id: string): boolean {
    return this.mods.has(id);
  }

  removeModifier(id: string): void {
    if (this.mods.delete(id)) this.invalidate();
  }

  removeByPrefix(prefix: string): void {
    let changed = false;
    for (const id of [...this.mods.keys()]) {
      if (id.startsWith(prefix)) {
        this.mods.delete(id);
        changed = true;
      }
    }
    if (changed) this.invalidate();
  }

  update(dt: number): void {
    let changed = false;
    for (const [id, m] of this.mods) {
      if (m.remaining === Infinity) continue;
      m.remaining -= dt;
      if (m.remaining <= 0) {
        this.mods.delete(id);
        changed = true;
      }
    }
    if (changed) this.invalidate();
  }

  private invalidate(): void {
    this.cache.clear();
    this.onChange?.();
  }
}
