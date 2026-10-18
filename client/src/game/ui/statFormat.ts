import { TAG_LABELS } from '../../data/upgrades';
import { STAT_LABELS, type StatKey } from '../components/StatsComponent';
import { STATUS_DEFS } from '../statuses/StatusDefinitions';
import type { UpgradePreview } from '../upgrades/UpgradeSystem';

/** Percentage with at most one decimal (0.055 → "5.5%", 0.1 → "10%"). */
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;

const FORMATS: Partial<Record<StatKey, (v: number) => string>> = {
  maxHealth: (v) => `${Math.round(v)}`,
  damage: (v) => v.toFixed(1),
  attackSpeed: (v) => `${v.toFixed(2)}/s`,
  moveSpeed: (v) => `${Math.round(v)}`,
  armor: (v) => `${Math.round(v)}`,
  critChance: pct,
  critDamage: (v) => `×${v.toFixed(2)}`,
  attackRange: (v) => `${Math.round(v)}`,
  attackArc: (v) => `${Math.round((v * 180) / Math.PI)}°`,
  size: pct,
  regen: (v) => `${v.toFixed(1)}/s`,
  cooldownReduction: (v) => pct(Math.min(0.6, v)),
  damageReduction: pct,
  repeatChance: pct,
  pickupRange: (v) => `${Math.round(v)}`,
  xpGain: pct,
  bleedDamage: pct,
  poisonDamage: pct,
  knockback: pct,
  extraTargets: (v) => `${Math.round(v)}`,
  summonDamage: pct,
};

/** Attack-tag names for the `dmg_<tag>` stats. */
const TAG_DAMAGE_LABELS: Record<string, string> = { bite: 'Dano Mordida', claw: 'Dano Garra', horn: 'Dano Chifre' };

export function statLabel(stat: StatKey): string {
  if (stat.startsWith('dmg_')) {
    const tag = stat.slice(4);
    return TAG_DAMAGE_LABELS[tag] ?? `Dano ${TAG_LABELS[tag] ?? tag}`;
  }
  return STAT_LABELS[stat] ?? stat;
}

export function formatStat(stat: StatKey, v: number): string {
  if (stat.startsWith('dmg_')) return `+${pct(v)}`;
  return (FORMATS[stat] ?? ((x: number) => `${+x.toFixed(2)}`))(v);
}

/** Card line: label plus formatted before/after values. */
export function formatPreview(p: UpgradePreview): { label: string; before: string; after: string } {
  if (p.kind === 'stat') return { label: statLabel(p.stat), before: formatStat(p.stat, p.before), after: formatStat(p.stat, p.after) };
  const name = STATUS_DEFS[p.status].name;
  if (p.kind === 'procChance') return { label: `Chance ${name}`, before: pct(p.before), after: pct(p.after) };
  return { label: `Acúmulos ${name}`, before: `${p.before}`, after: `${p.after}` };
}
