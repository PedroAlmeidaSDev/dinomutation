import { DINOSAURS, type DinoId } from './dinosaurs';
import { UPGRADE_BY_ID } from './upgrades';

/**
 * Keys used in RunState.damageBySource:
 * - 'attack' / 'ability' / 'summon' — the dino's basic attack, its ability, Matilha Fantasma ghosts;
 * - an upgrade id — damage dealt directly by that upgrade (Espinhos, Sangue Ácido, Cauda Clava…);
 * - 'bleed:<upgrade id>' / 'poison:<upgrade id>' — DoT ticks, credited to whoever applied the stacks;
 * - 'other' — hits without a source; 'debug' — debug kills (hidden).
 */
const DOT_LABELS: Record<string, string> = { bleed: 'Sangramento', poison: 'Veneno' };

export function damageSourceLabel(key: string, dinoId: DinoId): string {
  const dino = DINOSAURS[dinoId];
  if (key === 'attack') return `${dino.attack.name} (ataque)`;
  if (key === 'ability') return `${dino.abilityName} (habilidade)`;
  if (key === 'summon') return 'Matilha Fantasma';
  if (key === 'other') return 'Outros';
  const [head, origin] = key.split(':');
  if (origin !== undefined && DOT_LABELS[head]) {
    const from = UPGRADE_BY_ID[origin]?.name;
    return from ? `${DOT_LABELS[head]} · ${from}` : DOT_LABELS[head];
  }
  return UPGRADE_BY_ID[key]?.name ?? key;
}

export interface DamageRow {
  key: string;
  label: string;
  amount: number;
  /** 0..1 of the run's total. */
  share: number;
}

/** Sources sorted by damage, biggest first. */
export function damageBreakdown(bySource: Record<string, number>, dinoId: DinoId): DamageRow[] {
  const entries = Object.entries(bySource).filter(([k, v]) => k !== 'debug' && v >= 0.5);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return entries
    .map(([key, amount]) => ({ key, label: damageSourceLabel(key, dinoId), amount, share: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}
