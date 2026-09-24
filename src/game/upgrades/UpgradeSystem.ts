import { BALANCE, type Rarity } from '../../data/balance';
import type { DinoDef } from '../../data/dinosaurs';
import { TAG_COLORS, UPGRADES, UPGRADE_BY_ID } from '../../data/upgrades';
import type { RunContext } from '../core/RunContext';
import type { GameEventName } from '../core/EventBus';
import type { StatusProc } from '../combat/DamageSystem';
import { weightedPick } from '../../utils/math';
import { EFFECT_HANDLERS, type EffectRuntime } from './UpgradeEffects';
import type { EffectDefinition, UpgradeDefinition } from './UpgradeTypes';
import type { MetaBonus } from '../core/Save';

export interface UpgradeChoice {
  def: UpgradeDefinition;
  /** Level the upgrade will have after picking it. */
  nextLevel: number;
}

export interface RollOptions {
  count?: number;
  minRarity?: Rarity;
}

/** Tags too generic to define a build's identity. */
const GENERIC_TAGS = new Set(['physical', 'utility', 'health', 'heal', 'kill', 'ability', 'multi', 'aoe', 'mutation']);
const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, legendary: 2 };

/**
 * Owns the build: which upgrades the player has, how their effects are wired into
 * stats / damage / events, and how new choices are rolled.
 */
export class UpgradeSystem {
  private readonly owned = new Map<string, number>();
  private readonly order: string[] = [];
  private readonly states = new Map<string, Record<string, number>>();
  private readonly cleanups: (() => void)[] = [];
  /** Out-of-run bonuses (shop + passives): active all run, invisible to cards, tags and build UI. */
  private readonly meta = new Map<string, MetaBonus>();
  primaryTag: string | null = null;

  constructor(private readonly ctx: RunContext, private readonly dino: DinoDef) {}

  level(id: string): number {
    return this.owned.get(id) ?? 0;
  }

  has(id: string): boolean {
    return this.owned.has(id);
  }

  get ownedCount(): number {
    return this.order.length;
  }

  ownedList(): { def: UpgradeDefinition; level: number }[] {
    return this.order.map((id) => ({ def: UPGRADE_BY_ID[id], level: this.owned.get(id)! }));
  }

  /** Effective strength of an upgrade: its level, boosted by Evolução Apex for the primary tag. */
  power(id: string): number {
    const meta = this.meta.get(id);
    if (meta) return meta.level;
    const lvl = this.level(id);
    if (lvl === 0) return 0;
    const def = UPGRADE_BY_ID[id];
    if (this.ctx.player.flags.has('apex') && this.primaryTag && id !== 'evolucao_apex' && def.tags.includes(this.primaryTag)) {
      return lvl * BALANCE.upgrades.apexMultiplier;
    }
    return lvl;
  }

  /** Tag → weight, from owned upgrades (by level) and the dinosaur's innate tags. */
  buildTagCounts(includeInnate = true): Map<string, number> {
    const counts = new Map<string, number>();
    if (includeInnate) for (const t of this.dino.innateTags) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [id, lvl] of this.owned) {
      const def = UPGRADE_BY_ID[id];
      if (def.consumable) continue;
      for (const t of def.tags) counts.set(t, (counts.get(t) ?? 0) + lvl);
    }
    return counts;
  }

  private computePrimaryTag(): string | null {
    let best: string | null = null;
    let bestN = 0;
    for (const [t, n] of this.buildTagCounts(false)) {
      if (GENERIC_TAGS.has(t)) continue;
      if (n > bestN) {
        best = t;
        bestN = n;
      }
    }
    return best;
  }

  // ─────────────────────────── acquisition ───────────────────────────

  /** Applies out-of-run bonuses once, at run start. */
  applyMeta(bonuses: MetaBonus[]): void {
    if (bonuses.length === 0) return;
    for (const b of bonuses) {
      this.meta.set(b.id, b);
      this.wireTriggers(b);
      for (const eff of b.effects) if (eff.type === 'flag') this.ctx.player.flags.add(eff.flag);
    }
    this.rebuildStats();
    this.rebuildProcs();
  }

  acquire(id: string): void {
    const def = UPGRADE_BY_ID[id];
    if (!def) return;
    const player = this.ctx.player;

    for (const eff of def.effects) {
      if (eff.type === 'heal') player.health.heal(player.health.max * eff.percent);
    }

    const newLevel = this.level(id) + 1;
    this.owned.set(id, newLevel);
    if (newLevel === 1) {
      this.order.push(id);
      this.wireTriggers(def);
      for (const eff of def.effects) if (eff.type === 'flag') player.flags.add(eff.flag);
    }

    this.primaryTag = this.computePrimaryTag();
    this.rebuildStats();
    this.rebuildProcs();
    this.refreshVisuals();
    this.syncRunState();
    this.ctx.bus.emit('onUpgradeAcquired', { id, level: newLevel });
  }

  private wireTriggers(def: { id: string; effects: EffectDefinition[] }): void {
    const state: Record<string, number> = {};
    this.states.set(def.id, state);
    def.effects.forEach((eff) => {
      if (eff.type !== 'trigger') return;
      const handler = EFFECT_HANDLERS[eff.effect];
      if (!handler) {
        console.warn(`Unknown upgrade effect "${eff.effect}" in ${def.id}`);
        return;
      }
      const rt: EffectRuntime = {
        ctx: this.ctx,
        upgradeId: def.id,
        key: `upd:${def.id}`,
        params: eff.params ?? {},
        state,
        power: () => this.power(def.id),
      };
      const run = (payload: unknown) => handler(rt, payload);
      if (eff.trigger === 'modifyDamage') this.cleanups.push(this.ctx.damage.addOutgoingModifier(run));
      else if (eff.trigger === 'modifyIncoming') this.cleanups.push(this.ctx.damage.addIncomingModifier(run));
      else this.cleanups.push(this.ctx.bus.on(eff.trigger as GameEventName, run));
    });
  }

  /** Re-apply every static stat modifier from scratch (keeps levels & Apex consistent). */
  private rebuildStats(): void {
    const stats = this.ctx.player.stats;
    stats.removeByPrefix('ups:');
    for (const id of this.order) {
      const def = UPGRADE_BY_ID[id];
      const power = def.consumable ? this.level(id) : this.power(id);
      def.effects.forEach((eff, i) => {
        if (eff.type === 'stat') stats.setModifier(`ups:${id}:${i}`, eff.stat, eff.mode, eff.value * power);
      });
    }
    for (const b of this.meta.values()) {
      b.effects.forEach((eff, i) => {
        if (eff.type === 'stat') stats.setModifier(`ups:${b.id}:${i}`, eff.stat, eff.mode, eff.value * b.level);
      });
    }
  }

  private rebuildProcs(): void {
    const procs: StatusProc[] = [];
    const sources = [...this.order.map((id) => UPGRADE_BY_ID[id]), ...this.meta.values()];
    for (const def of sources) {
      const id = def.id;
      const power = this.power(id);
      def.effects.forEach((eff, i) => {
        if (eff.type !== 'statusOnHit') return;
        procs.push({
          key: `${id}:${i}`,
          status: eff.status,
          chance: Math.min(1, eff.chance * power),
          stacks: Math.max(1, Math.round(eff.stacks * power)),
          duration: eff.duration,
          tags: eff.tags,
        });
      });
    }
    this.ctx.damage.setStatusProcs(procs);
  }

  private refreshVisuals(): void {
    const tags = new Set<string>();
    for (const id of this.order) for (const v of UPGRADE_BY_ID[id].visual ?? []) tags.add(v);
    const aura = this.primaryTag && this.ownedCount >= 3 ? TAG_COLORS[this.primaryTag] ?? null : null;
    this.ctx.player.refreshVisuals(tags, aura);
  }

  private syncRunState(): void {
    this.ctx.run.upgrades = this.ownedList()
      .filter((u) => !u.def.consumable)
      .map((u) => ({ id: u.def.id, name: u.def.name, rarity: u.def.rarity, level: u.level }));
    this.ctx.run.primaryTag = this.primaryTag ?? undefined;
  }

  // ─────────────────────────── rolling ───────────────────────────

  isEligible(def: UpgradeDefinition): boolean {
    if (this.level(def.id) >= def.maxLevel) return false;
    const r = def.requires;
    if (!r) return true;
    if (r.dinos && !r.dinos.includes(this.dino.id)) return false;
    if (r.attackTags && !r.attackTags.some((t) => this.dino.attack.tags.includes(t))) return false;
    if (r.abilityTags && !r.abilityTags.some((t) => this.dino.abilityTags.includes(t))) return false;
    if (r.upgrades && !r.upgrades.every((u) => this.has(u))) return false;
    if (r.minUpgrades && this.ownedCount < r.minUpgrades) return false;
    if (r.ownedTags) {
      const counts = this.buildTagCounts(true);
      for (const t of this.dino.abilityTags) counts.set(t, (counts.get(t) ?? 0) + 1);
      if (!r.ownedTags.some((t) => (counts.get(t) ?? 0) > 0)) return false;
    }
    return true;
  }

  private weight(def: UpgradeDefinition, tagCounts: Map<string, number>, boostLegendary: boolean): number {
    const U = BALANCE.upgrades;
    const lvl = this.ctx.xp.level;
    let w = U.rarityWeights[def.rarity] + U.rarityWeightPerLevel[def.rarity] * lvl;
    if (boostLegendary && def.rarity === 'legendary') w *= 2.5;
    // Soft synergy nudge: shared tags make an upgrade a bit more likely.
    let shared = 0;
    for (const t of def.tags) if (!GENERIC_TAGS.has(t)) shared += Math.min(3, tagCounts.get(t) ?? 0);
    w *= 1 + Math.min(U.affinityMax, shared * U.affinityPerSharedTag);
    // Leveling up something you already own is slightly favoured too.
    if (this.has(def.id)) w *= 1.15;
    return w;
  }

  roll(opts: RollOptions = {}): UpgradeChoice[] {
    const count = opts.count ?? 3;
    const minRank = RARITY_RANK[opts.minRarity ?? 'common'];
    const tagCounts = this.buildTagCounts(true);
    let pool = UPGRADES.filter((u) => !u.consumable && RARITY_RANK[u.rarity] >= minRank && this.isEligible(u));
    const picks: UpgradeDefinition[] = [];
    while (picks.length < count && pool.length > 0) {
      const pick = weightedPick(pool, (u) => this.weight(u, tagCounts, minRank > 0));
      if (!pick) break;
      picks.push(pick);
      pool = pool.filter((u) => u !== pick);
    }
    // Rare/legendary rolls fall back to the common pool if exhausted.
    if (picks.length < count && minRank > 0) {
      let extra = UPGRADES.filter((u) => !u.consumable && !picks.includes(u) && this.isEligible(u));
      while (picks.length < count && extra.length > 0) {
        const pick = weightedPick(extra, (u) => this.weight(u, tagCounts, false))!;
        picks.push(pick);
        extra = extra.filter((u) => u !== pick);
      }
    }
    for (const c of UPGRADES.filter((u) => u.consumable)) {
      if (picks.length >= count) break;
      picks.push(c);
    }
    return picks.map((def) => ({ def, nextLevel: this.level(def.id) + 1 }));
  }

  destroy(): void {
    for (const c of this.cleanups) c();
    this.cleanups.length = 0;
  }
}
