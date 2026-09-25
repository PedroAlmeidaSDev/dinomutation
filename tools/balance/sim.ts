/**
 * Simulador de balanceamento (modelo analítico + Monte Carlo).
 *
 * Usa os MESMOS dados do jogo (src/data/*) e replica a lógica de sorteio de upgrades
 * do UpgradeSystem. Não roda o Phaser: movimento/esquiva são aproximados por fatores
 * de uptime e densidade. Serve para comparar configurações, não para prever o
 * resultado exato de uma run.
 *
 * Uso:  node --experimental-strip-types tools/balance/sim.ts [runs] [--antes] [--json saida.json]
 *       [--meta nenhum|inicial|medio|max]   perfil fixo de meta-progressão (loja + passivas)
 *       [--carreira [carreiras]]            joga runs seguidas acumulando Fósseis/Maestria desde zero
 *       [--analise]                         vitória por dino, build e mutação (jogador médio)
 */
import { BALANCE, xpToNext, type Rarity } from '../../src/data/balance.ts';
import { DIRECTOR_CONFIG } from '../../src/data/director.ts';
import { ENEMIES, type EnemyId } from '../../src/data/enemies.ts';
import { DINOSAURS, DINO_ORDER, type DinoDef, type DinoId } from '../../src/data/dinosaurs.ts';
import { UPGRADES, UPGRADE_BY_ID } from '../../src/data/upgrades.ts';
import { STAT_DEFAULTS, type StatKey } from '../../src/game/components/StatsComponent.ts';
import type { UpgradeDefinition } from '../../src/game/upgrades/UpgradeTypes.ts';
import { META_ECONOMY, SHOP, fossilsForRun, loadoutFor, masteryLevel, masteryXpForRun, type MetaBonus } from '../../src/data/meta.ts';

// ─────────────────────────── premissas do modelo ───────────────────────────
const ASSUME = {
  /** Fração do tempo em que o jogador está batendo (resto: reposicionando/esquivando). */
  meleeUptime: 0.8,
  bossUptime: 0.7,
  /** DNA que o jogador realmente coleta. */
  pickupEfficiency: 0.95,
  /** Fração dos ataques telegrafados do chefe que um jogador médio esquiva. */
  bossDodge: 0.6,
  /**
   * Fração do dano teórico (100% de acertos) que realmente acerta quem fica colado no chefe:
   * círculos aleatórios, pedras fora do alvo e iFrames. Calibrado com `npm run test:boss`
   * (~17,8/s medido ÷ ~27/s teórico).
   */
  bossTankHitRate: 0.66,
  /** Compys/raptors invocados pelo chefe mortos por segundo durante a luta (afeta on-kill). */
  bossFightKillsPerSec: 0.8,
  /** Inimigos sangrando por perto durante a luta do chefe (Sangue Quente). */
  bossFightBleedingNearby: 3,
};

/**
 * Regras de mecânica lidas dos dados do jogo (o que o código faz hoje).
 * `--antes` restaura os valores anteriores à Etapa 1 do plano, para comparação.
 */
const aps = BALANCE.player.softCaps.attackSpeed;
const voracity = UPGRADE_BY_ID.voracidade.effects.find((e) => e.type === 'trigger');
const hemophagy = UPGRADE_BY_ID.hemofagia.effects.find((e) => e.type === 'trigger');
const gp = ENEMIES.giganotosaurus.params;
const RULES = {
  hpPerMinuteSq: BALANCE.enemyScaling.hpPerMinuteSq,
  /** Acima deste bônus de vel. de ataque, o excedente rende só `apsSoftCapRate`. */
  apsSoftCap: aps.above,
  apsSoftCapRate: aps.rate,
  /** Voracidade: cura por abate e teto de cura/s por nível. */
  voracityPerKill: Number(voracity?.type === 'trigger' ? voracity.params?.amount ?? 1 : 1),
  voracityCapPerLevel: Number(voracity?.type === 'trigger' ? voracity.params?.maxPerSec ?? Infinity : Infinity),
  /** Hemofagia dispara em ticks de DoT (antes: sim; agora só golpes diretos). */
  hemophagyOnDot: false,
  hemophagyAmount: Number(hemophagy?.type === 'trigger' ? hemophagy.params?.amount ?? 1.2 : 1.2),
  /** Lacaios do chefe contam para efeitos de abate. */
  summonsGiveRewards: false,
  /** Chefe enfurece após N segundos de luta (dano ×mult). */
  bossEnrageAt: gp.enrageTime ?? Infinity,
  bossEnrageMult: gp.enrageDamage ?? 1,
  /** Fração da redução de dano do jogador ignorada pelos ataques pesados do chefe. */
  bossPierce: gp.pierce ?? 0,
  /** Chefe em 3 fases (antes: 2). */
  bossPhases: (gp.phase3At ? 3 : 2) as 2 | 3,
};

/** Valores anteriores à Etapa 1 (commit 2ba080f), para comparar antes × depois. */
function applyOriginal(): void {
  BALANCE.xp.exponent = 1.38;
  RULES.hpPerMinuteSq = 0;
  BALANCE.enemyScaling.hpPerMinute = 0.24;
  BALANCE.enemyScaling.damagePerMinute = 0.07;
  BALANCE.player.iFrames = 0.35;
  BALANCE.combat.maxDamageReduction = 0.7;
  RULES.apsSoftCap = Infinity;
  RULES.apsSoftCapRate = 1;
  RULES.voracityPerKill = 1;
  RULES.voracityCapPerLevel = Infinity;
  RULES.hemophagyOnDot = true;
  RULES.hemophagyAmount = 1.2;
  RULES.summonsGiveRewards = true;
  RULES.bossEnrageAt = Infinity;
  RULES.bossEnrageMult = 1;
  RULES.bossPierce = 0;
  RULES.bossPhases = 2;
  DINOSAURS.trex.attack.maxTargets = 1;
  Object.assign(DINOSAURS.trex.stats, { maxHealth: 170, armor: 6, attackArc: 1.9 });
  Object.assign(DINOSAURS.raptor.stats, { maxHealth: 125, damage: 10, armor: 5 });
  Object.assign(DINOSAURS.triceratops.stats, { armor: 40, regen: 1.2 });
  Object.assign(AB.roar, { cooldown: 10, coef: 0.6 });
  Object.assign(AB.pounce, { cooldown: 3.5, coef: 2.2 });
  Object.assign(AB.charge, { cooldown: 6.5, stun: 1.1 });
  Object.assign(ABILITY_CD, { roar: 10, pounce: 3.5, charge: 6.5 });
  Object.assign(tp, { armorScale: 0.8 });
  Object.assign(fp, { perArmor: 0.012, maxBonus: Infinity });

  const alpha = ENEMIES.carnoAlpha;
  alpha.hp = 1800;
  alpha.armor = 15;
  Object.assign(alpha.params, { damage: 32, chargeDamage: 34, shockDamage: 26 });

  const g = ENEMIES.giganotosaurus;
  g.hp = 9500;
  g.armor = 30;
  Object.assign(g.params, { biteDamage: 38, chargeDamage: 40, stompDamage: 30, roarDamage: 16, attackCooldown: 1.25 });

  const phases = DIRECTOR_CONFIG.phases;
  const lull = phases.find((p) => p.start === 330);
  if (lull) Object.assign(lull, { interval: 1.0, batch: [2, 4], maxAlive: 80 });
  const bossPhase = phases.find((p) => p.start === 540);
  if (bossPhase) Object.assign(bossPhase, { interval: 1.4, batch: [2, 4], maxAlive: 45 });
}

/** Aplica BALANCE.bossScaling direto nos dados do chefe (o jogo aplica na hora do spawn). */
function applyBossScaling(hpMult: number, dmgMult: number): void {
  const g = ENEMIES.giganotosaurus;
  g.hp = Math.round(g.hp * hpMult);
  for (const k of Object.keys(g.params)) if (k.endsWith('Damage')) g.params[k] = Math.round(g.params[k] * dmgMult);
  g.contactDamage = Math.round(g.contactDamage * dmgMult);
}

const effApsMult = (m: number) => (m <= RULES.apsSoftCap ? m : RULES.apsSoftCap + (m - RULES.apsSoftCap) * RULES.apsSoftCapRate);

const AB = BALANCE.abilities;
const ABILITY_CD: Record<string, number> = { roar: AB.roar.cooldown, pounce: AB.pounce.cooldown, charge: AB.charge.cooldown };
const thorns = UPGRADE_BY_ID.espinhos.effects.find((e) => e.type === 'trigger');
const fortaleza = UPGRADE_BY_ID.fortaleza_viva.effects.find((e) => e.type === 'trigger');
const tp = (thorns?.type === 'trigger' ? thorns.params : undefined) ?? {};
const fp = (fortaleza?.type === 'trigger' ? fortaleza.params : undefined) ?? {};
/** Espinhos: dano refletido por golpe corpo a corpo recebido. */
const thornsHit = (b: Build) => (Number(tp.flat ?? 10) + Math.max(0, b.stat('armor')) * Number(tp.armorScale ?? 0.8)) * b.power('espinhos');
const GENERIC_TAGS = new Set(['physical', 'utility', 'health', 'heal', 'kill', 'ability', 'multi', 'aoe', 'mutation']);
const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, legendary: 2 };

/** mixed: cada escolha tem 50% de ser a melhor e 50% de ser aleatória (proxy de jogador médio). */
type Picker = 'smart' | 'mixed' | 'random';

// ─────────────────────────── build ───────────────────────────
class Build {
  owned = new Map<string, number>();
  order: string[] = [];
  primaryTag: string | null = null;
  readonly dino: DinoDef;
  /** Meta-progressão: níveis de loja (stats) e passivas desbloqueadas. */
  readonly meta: MetaBonus[];
  readonly passives: Set<string>;
  constructor(dino: DinoDef, meta: MetaBonus[] = []) {
    this.dino = dino;
    this.meta = meta;
    this.passives = new Set(meta.filter((m) => m.id.startsWith('pas_')).map((m) => m.id));
  }

  clone(): Build {
    const b = new Build(this.dino, this.meta);
    b.owned = new Map(this.owned);
    b.order = [...this.order];
    b.primaryTag = this.primaryTag;
    return b;
  }

  level(id: string) { return this.owned.get(id) ?? 0; }
  has(id: string) { return this.owned.has(id); }
  get flags(): Set<string> {
    const f = new Set<string>();
    for (const id of this.order) for (const e of UPGRADE_BY_ID[id].effects) if (e.type === 'flag') f.add(e.flag);
    return f;
  }

  power(id: string): number {
    const lvl = this.level(id);
    if (!lvl) return 0;
    const def = UPGRADE_BY_ID[id];
    if (this.has('evolucao_apex') && this.primaryTag && id !== 'evolucao_apex' && def.tags.includes(this.primaryTag)) {
      return lvl * BALANCE.upgrades.apexMultiplier;
    }
    return lvl;
  }

  tagCounts(includeInnate = true): Map<string, number> {
    const c = new Map<string, number>();
    if (includeInnate) for (const t of this.dino.innateTags) c.set(t, (c.get(t) ?? 0) + 1);
    for (const [id, lvl] of this.owned) {
      const d = UPGRADE_BY_ID[id];
      if (d.consumable) continue;
      for (const t of d.tags) c.set(t, (c.get(t) ?? 0) + lvl);
    }
    return c;
  }

  acquire(id: string): void {
    const lvl = this.level(id) + 1;
    this.owned.set(id, lvl);
    if (lvl === 1) this.order.push(id);
    let best: string | null = null;
    let bestN = 0;
    for (const [t, n] of this.tagCounts(false)) {
      if (GENERIC_TAGS.has(t)) continue;
      if (n > bestN) { best = t; bestN = n; }
    }
    this.primaryTag = best;
  }

  stat(key: StatKey): number {
    let add = 0;
    let mult = 0;
    for (const id of this.order) {
      const def = UPGRADE_BY_ID[id];
      const pw = def.consumable ? this.level(id) : this.power(id);
      for (const e of def.effects) {
        if (e.type !== 'stat' || e.stat !== key) continue;
        if (e.mode === 'add') add += e.value * pw; else mult += e.value * pw;
      }
    }
    for (const m of this.meta) {
      for (const e of m.effects) {
        if (e.type !== 'stat' || e.stat !== key) continue;
        if (e.mode === 'add') add += e.value * m.level; else mult += e.value * m.level;
      }
    }
    const base = (this.dino.stats as Record<string, number>)[key] ?? STAT_DEFAULTS[key] ?? 0;
    return (base + add) * (1 + mult);
  }

  isEligible(def: UpgradeDefinition): boolean {
    if (this.level(def.id) >= def.maxLevel) return false;
    const r = def.requires;
    if (!r) return true;
    if (r.dinos && !r.dinos.includes(this.dino.id)) return false;
    if (r.attackTags && !r.attackTags.some((t) => this.dino.attack.tags.includes(t))) return false;
    if (r.abilityTags && !r.abilityTags.some((t) => this.dino.abilityTags.includes(t))) return false;
    if (r.upgrades && !r.upgrades.every((u) => this.has(u))) return false;
    if (r.minUpgrades && this.order.length < r.minUpgrades) return false;
    if (r.ownedTags) {
      const c = this.tagCounts(true);
      for (const t of this.dino.abilityTags) c.set(t, (c.get(t) ?? 0) + 1);
      if (!r.ownedTags.some((t) => (c.get(t) ?? 0) > 0)) return false;
    }
    return true;
  }

  weight(def: UpgradeDefinition, tc: Map<string, number>, playerLevel: number, boostLegendary: boolean): number {
    const U = BALANCE.upgrades;
    let w = U.rarityWeights[def.rarity] + U.rarityWeightPerLevel[def.rarity] * playerLevel;
    if (boostLegendary && def.rarity === 'legendary') w *= 2.5;
    let shared = 0;
    for (const t of def.tags) if (!GENERIC_TAGS.has(t)) shared += Math.min(3, tc.get(t) ?? 0);
    w *= 1 + Math.min(U.affinityMax, shared * U.affinityPerSharedTag);
    if (this.has(def.id)) w *= 1.15;
    return w;
  }

  roll(playerLevel: number, minRarity: Rarity = 'common', count = 3): UpgradeDefinition[] {
    const minRank = RARITY_RANK[minRarity];
    const tc = this.tagCounts(true);
    let pool = UPGRADES.filter((u) => !u.consumable && RARITY_RANK[u.rarity] >= minRank && this.isEligible(u));
    const picks: UpgradeDefinition[] = [];
    const pickFrom = (list: UpgradeDefinition[], boost: boolean) => weighted(list, (u) => this.weight(u, tc, playerLevel, boost));
    while (picks.length < count && pool.length) {
      const p = pickFrom(pool, minRank > 0);
      picks.push(p);
      pool = pool.filter((u) => u !== p);
    }
    if (picks.length < count && minRank > 0) {
      let extra = UPGRADES.filter((u) => !u.consumable && !picks.includes(u) && this.isEligible(u));
      while (picks.length < count && extra.length) {
        const p = pickFrom(extra, false);
        picks.push(p);
        extra = extra.filter((u) => u !== p);
      }
    }
    for (const c of UPGRADES.filter((u) => u.consumable)) if (picks.length < count) picks.push(c);
    return picks;
  }
}

function weighted<T>(list: T[], w: (t: T) => number): T {
  const total = list.reduce((s, t) => s + w(t), 0);
  let r = Math.random() * total;
  for (const t of list) { r -= w(t); if (r <= 0) return t; }
  return list[list.length - 1];
}

// ─────────────────────────── combate (modelo) ───────────────────────────
interface Target { hp: number; armor: number; boss: boolean }

interface Combat {
  hitDamage: number;       // dano médio por golpe básico (antes da armadura do alvo)
  attacksPerSec: number;   // golpes/s (inclui repetição)
  critMult: number;
  singleDps: number;       // vs alvo único (chefe), já com armadura, DoTs, invocações, habilidade
  bossTtk: number;
  eliteTtk: number;
  maxHp: number;
  reduction: number;
  ehp: number;
  sustainBoss: number;     // cura/s durante a luta contra o chefe
  bossIncomingTank: number;  // dano/s recebido do chefe sem esquivar
  bossIncomingDodge: number; // dano/s recebido do chefe esquivando ASSUME.bossDodge
  hitsToDieBite: number;
}

function armorFactor(a: number) { return BALANCE.combat.enemyArmorConstant / (BALANCE.combat.enemyArmorConstant + a); }

/** Valores comuns derivados do build. */
function derive(b: Build) {
  const d = b.dino;
  const pw = (id: string) => b.power(id);
  const flags = b.flags;
  const damage = b.stat('damage');
  const tagBonus = d.attack.tags.reduce((s, t) => s + b.stat(`dmg_${t}` as StatKey), 0);
  const cdr = Math.min(0.6, b.stat('cooldownReduction'));
  const abilityCd = ABILITY_CD[d.ability] * (1 - cdr);
  // Buff do rugido: +40% de dano por 4s a cada recarga.
  const roarUptime = d.ability === 'roar' ? Math.min(1, 4 / abilityCd) : 0;
  // O buff entra na soma de multiplicadores: (base+add)×(1+Σmult+0.4).
  const baseDamage = (d.stats.damage ?? 10);
  const dmgStat = damage + baseDamage * 0.4 * roarUptime;
  // Buffs 'mult' entram na MESMA soma: base × (1 + Σmult). Frenesi em combate contínuo = 12 acúmulos.
  const apsBase = d.stats.attackSpeed ?? 1;
  let apsMult = b.stat('attackSpeed') / apsBase - 1;
  if (b.has('frenesi')) apsMult += 0.025 * 12 * pw('frenesi');
  const repeat = Math.min(1, b.stat('repeatChance'));
  return { damage: dmgStat, baseDamage, rawDamage: damage, tagBonus, cdr, abilityCd, apsBase, apsMult, aps: apsBase * (1 + effApsMult(apsMult)), repeat, flags, pw };
}

function critAvg(chance: number, mult: number) { return 1 + Math.min(1, chance) * (mult - 1); }

/** DPS contra um alvo único (chefe/elite). */
function singleTargetDps(b: Build, t: Target, killsPerSec: number, bleedingNearby: number): { dps: number; hitsPerSec: number; hitDamage: number; critMult: number } {
  const x = derive(b);
  const { pw } = x;
  const af = armorFactor(t.armor);
  let apsMult = x.apsMult;
  if (b.has('predador_frenetico')) apsMult += Math.min(10, killsPerSec * 3) * 0.04 * pw('predador_frenetico');
  const aps = x.apsBase * (1 + effApsMult(apsMult));
  const swings = aps * (1 + x.repeat);

  // Bônus condicionais (aditivos).
  let bonus = x.tagBonus;
  if (b.has('fortaleza_viva')) bonus += Math.min(Number(fp.maxBonus ?? Infinity), Math.max(0, b.stat('armor')) * Number(fp.perArmor ?? 0.012)) * pw('fortaleza_viva');
  if (b.has('toxinas_corrosivas')) bonus += 0.25 * pw('toxinas_corrosivas'); // veneno sempre ativo no chefe
  // Execução: bônus só nos últimos 30% de vida → média ponderada por HP.
  let execMult = 1;
  if (b.has('execucao')) { const eb = 0.35 * pw('execucao'); execMult = 1 / (0.7 + 0.3 / (1 + eb)); }
  // Passiva Rei Tirano: +20% abaixo de 25% de vida.
  if (b.passives.has('pas_trex_tirano')) execMult *= 1 / (0.75 + 0.25 / 1.2);
  // Sangue Quente: multiplicador sobre o stat de dano.
  let sq = 0;
  if (b.has('sangue_quente')) sq = Math.min(0.6 * pw('sangue_quente'), bleedingNearby * 0.04 * pw('sangue_quente'));
  const dmgMult = (x.damage + x.baseDamage * sq) / x.damage;

  let critChance = b.stat('critChance');
  if (b.has('instinto_assassino')) critChance += 0.5 * 0.2 * pw('instinto_assassino');
  if (b.passives.has('pas_trex_presas')) critChance += 0.5 * 0.08;
  const cm = critAvg(critChance, b.stat('critDamage'));

  const dmg = x.damage * dmgMult;
  const hit = dmg * d_coef(b) * (1 + bonus);
  let dps = hit * cm * af * swings * execMult;

  // Cauda Clava: a cada 4 ataques.
  if (b.has('cauda_clava')) dps += (swings / 4) * dmg * 0.9 * pw('cauda_clava') * (1 + b.stat('dmg_tail' as StatKey)) * cm * af;

  // Sangramento: reaplicado constantemente → vai ao limite de acúmulos.
  let bleedStacksPerSec = 0;
  if (b.has('dentes_serrilhados')) bleedStacksPerSec += swings * Math.max(1, Math.round(2 * pw('dentes_serrilhados')));
  if (b.has('garras_serrilhadas')) bleedStacksPerSec += swings * Math.min(1, 0.5 * pw('garras_serrilhadas')) * Math.max(1, Math.round(pw('garras_serrilhadas')));
  const bleedPot = (BALANCE.statuses.bleed.dpsPerStack + x.rawDamage * dmgMult * BALANCE.statuses.bleed.damageScaling) * b.stat('bleedDamage');
  const bleedStacks = Math.min(BALANCE.statuses.bleed.maxStacks, bleedStacksPerSec * BALANCE.statuses.bleed.duration);
  dps += bleedStacks * bleedPot * af;

  let poisonStacksPerSec = 0;
  if (b.has('glandulas_venenosas')) poisonStacksPerSec += swings * Math.min(1, 0.35 * pw('glandulas_venenosas')) * Math.max(1, Math.round(2 * pw('glandulas_venenosas')));
  const poisonPot = (BALANCE.statuses.poison.dpsPerStack + x.rawDamage * dmgMult * BALANCE.statuses.poison.damageScaling) * b.stat('poisonDamage');
  const poisonStacks = Math.min(BALANCE.statuses.poison.maxStacks, poisonStacksPerSec * BALANCE.statuses.poison.duration);
  dps += poisonStacks * poisonPot * af;

  // Invocações.
  if (b.has('matilha_fantasma')) {
    const pack = x.flags.has('packPersist');
    const count = Math.max(1, Math.floor(pw('matilha_fantasma'))) + (pack ? 1 : 0);
    const clawBonus = 1 + b.stat('dmg_claw' as StatKey);
    const perGhost = pack ? (6 / 0.45) * 1.2 : 1.5;
    const interval = pack ? 6 : 5;
    dps += (count * perGhost * dmg * b.stat('summonDamage') * clawBonus * cm * af) / interval;
  }

  // Habilidade (e Impacto Sísmico / Massa Imparável).
  let cd = x.abilityCd;
  if (b.has('cacador_voraz')) cd = Math.max(0.5, cd / (1 + killsPerSec * 0.2 * pw('cacador_voraz') / 1));
  const momentum = b.has('massa_imparavel') ? 0.5 * pw('massa_imparavel') : 0; // ímpeto médio 50%
  if (b.dino.ability === 'charge') dps += (dmg * AB.charge.coef * (1 + momentum) * cm * af) / cd;
  if (b.dino.ability === 'pounce') dps += (dmg * AB.pounce.coef * (1 + momentum) * (1 + b.stat('dmg_claw' as StatKey)) * cm * af) / cd;
  if (b.dino.ability === 'roar') dps += (dmg * AB.roar.coef * af) / cd;
  if (b.has('impacto_sismico')) dps += (dmg * 1.4 * pw('impacto_sismico') * cm * af) / cd;

  // Espinhos: ~0.35 golpes corpo a corpo/s do chefe (esquivando).
  if (b.has('espinhos')) dps += 0.35 * thornsHit(b) * af;

  // Passivas de maestria.
  if (b.passives.has('pas_raptor_alfa')) dps += (dmg * 1.2 * b.stat('summonDamage') * (1 + b.stat('dmg_claw' as StatKey)) * cm * af) / 9;
  if (b.passives.has('pas_tri_espinhos')) dps += 0.35 * (6 + Math.max(0, b.stat('armor')) * 0.3) * af;
  if (b.passives.has('pas_tri_tremor')) dps += (dmg * 1.2 * cm * af) / cd;

  return { dps, hitsPerSec: swings, hitDamage: hit * cm, critMult: cm };
}

function d_coef(b: Build) { return b.dino.attack.coef; }

function defense(b: Build) {
  const armor = b.stat('armor');
  const armorRed = armor >= 0 ? 1 - BALANCE.combat.armorConstant / (BALANCE.combat.armorConstant + armor) : armor / BALANCE.combat.armorConstant;
  // Placas Ósseas: ativo praticamente o tempo todo em combate pesado.
  const placas = b.has('placas_osseas') ? 0.12 * b.power('placas_osseas') : 0;
  // Passiva Couraça Viva: +8% por 2s ao sofrer dano → ativa quase sempre em combate.
  const couraca = b.passives.has('pas_tri_couraca') ? 0.08 : 0;
  const reduction = Math.min(BALANCE.combat.maxDamageReduction, armorRed + placas + couraca);
  const maxHp = b.stat('maxHealth');
  return { armor, reduction, maxHp, ehp: maxHp / (1 - reduction) };
}

function sustain(b: Build, killsPerSec: number, hitsPerSec: number): number {
  let h = b.stat('regen');
  if (b.has('voracidade')) {
    const pw = b.power('voracidade');
    h += Math.min(RULES.voracityCapPerLevel * pw, killsPerSec * RULES.voracityPerKill * pw);
  }
  // Hoje o onHit também dispara nos ticks de sangramento → bate direto na recarga interna (5/s).
  if (b.has('hemofagia') && (b.has('dentes_serrilhados') || b.has('garras_serrilhadas'))) {
    const procs = RULES.hemophagyOnDot ? (hitsPerSec > 0 ? 5 : 0) : Math.min(5, hitsPerSec);
    h += procs * RULES.hemophagyAmount * b.power('hemofagia');
  }
  return h;
}

/** Dano/s do chefe se todos os ataques acertarem. */
/** Ritmo por fase — espelha TEMPO em Giganotosaurus.ts. */
const BOSS_TEMPO = {
  1: { windup: 1, cooldown: 1 },
  2: { windup: 0.85, cooldown: 0.75 },
  3: { windup: 0.75, cooldown: 0.6 },
} as const;

/** Dano/s do chefe se todos os ataques acertarem (jogador colado nele). */
function bossRawDps(phase: 1 | 2 | 3): number {
  const p = ENEMIES.giganotosaurus.params;
  if (RULES.bossPhases === 2) {
    // Chefe antigo: 2 fases (fúria a 50%), sem combo nem terremoto.
    const avg = (5 * p.biteDamage + 2 * p.roarDamage + 3 * p.stompDamage + 1 * (p.chargeDamage + 18)) / 11;
    const windup = (5 * p.biteWindup + 2 * p.roarWindup + 3 * p.stompWindup + 1 * (p.chargeWindup + p.chargeTime)) / 11;
    const two = phase >= 2;
    return avg / (windup * (two ? 0.78 : 1) + 0.7 + p.attackCooldown * (two ? 0.65 : 1));
  }
  const tempo = BOSS_TEMPO[phase];
  const bites = phase === 3 ? 3 : 2;
  const chain = phase >= 2 ? p.chargeChain : 1;
  // [peso, dano por uso, duração (wind-ups + execução)]
  const mix: [number, number, number][] = [
    [3, p.biteDamage, p.biteWindup * tempo.windup],
    [phase === 1 ? 2 : 3, p.biteDamage * bites, p.comboWindup * tempo.windup * bites],
    [2, p.roarDamage, p.roarWindup * tempo.windup],
    [3, p.stompDamage, p.stompWindup * tempo.windup],
    [1, (p.chargeDamage + 18) * chain, (p.chargeWindup * tempo.windup + p.chargeTime) + (chain - 1) * (p.chargeReaim * tempo.windup + p.chargeTime)],
  ];
  // Terremoto: ~35% das pedras caem em cima do jogador; iFrames limitam a 1 acerto a cada ~0,35s.
  if (phase === 3) mix.push([2.5, (p.quakeDuration / p.quakeInterval) * 0.35 * p.quakeDamage, 0.9 + p.quakeDuration]);
  const W = mix.reduce((s, m) => s + m[0], 0);
  const dmg = mix.reduce((s, m) => s + m[0] * m[1], 0) / W;
  const dur = mix.reduce((s, m) => s + m[0] * m[2], 0) / W;
  return dmg / (dur + 0.7 + p.attackCooldown * tempo.cooldown);
}

/** Média ponderada pelo tempo em cada fase (cada fase = 1/3 da vida). */
function bossAvgRawDps(): number {
  return RULES.bossPhases === 2 ? (bossRawDps(1) + bossRawDps(2)) / 2 : (bossRawDps(1) + bossRawDps(2) + bossRawDps(3)) / 3;
}

// ─────────────────────────── diretor / economia ───────────────────────────
function phaseAt(t: number) {
  let cur = DIRECTOR_CONFIG.phases[0];
  for (const p of DIRECTOR_CONFIG.phases) if (t >= p.start) cur = p;
  return cur;
}

function hpScale(t: number): number {
  const m = t / 60;
  return 1 + BALANCE.enemyScaling.hpPerMinute * m + RULES.hpPerMinuteSq * m * m;
}

function mixStats(pool: Partial<Record<EnemyId, number>>, t: number) {
  const hpMult = hpScale(t);
  const dmgMult = 1 + BALANCE.enemyScaling.damagePerMinute * (t / 60);
  let W = 0, hp = 0, xp = 0, armor = 0, contact = 0;
  const types: { id: EnemyId; w: number; hp: number; armor: number }[] = [];
  for (const [id, w] of Object.entries(pool) as [EnemyId, number][]) {
    const e = ENEMIES[id];
    W += w; hp += w * e.hp * hpMult; xp += w * e.xp; armor += w * e.armor;
    const c = id === 'pachy' ? e.params.damage : id === 'carnotaurus' ? e.params.damage : id === 'wildRaptor' ? e.params.lungeDamage : id === 'dilophosaurus' || id === 'pterosaur' ? e.params.damage : e.contactDamage;
    contact += w * c;
    types.push({ id, w, hp: e.hp * hpMult, armor: e.armor });
  }
  return { hp: hp / W, xp: xp / W, armor: armor / W, contact: (contact / W) * dmgMult, types: types.map((x) => ({ ...x, w: x.w / W })), dmgMult };
}

/** Quantos inimigos comuns por segundo o build consegue matar, dado quantos estão vivos. */
function killCapacity(b: Build, t: number, alive: number): number {
  const phase = phaseAt(t);
  const mix = mixStats(phase.pool, t);
  const x = derive(b);
  const { pw } = x;
  const execTh = Math.max(b.has('execucao') ? Math.min(0.9, 0.06 * pw('execucao')) : 0, b.passives.has('pas_trex_tirano') ? 0.03 : 0);
  const st = singleTargetDps(b, { hp: mix.hp, armor: mix.armor, boss: false }, 3, 5);
  const swings = st.hitsPerSec * ASSUME.meleeUptime;

  const hitsToKill = (dmg: number) => mix.types.reduce((s, ty) => s + ty.w * Math.max(1, Math.ceil((ty.hp * (1 - execTh)) / Math.max(1, dmg * armorFactor(ty.armor)))), 0);
  // DoTs somam ~50% do dano teórico ao alvo antes de ele morrer.
  const dotPerHit = (st.dps - st.hitDamage * armorFactor(mix.armor) * st.hitsPerSec) / Math.max(0.1, st.hitsPerSec) * 0.25;
  const perHit = st.hitDamage + Math.max(0, dotPerHit);

  const arcTargets = Math.max(1, Math.min(8, alive / 12));
  const maxT = x.flags.has('carnage') ? arcTargets : Math.min(b.dino.attack.maxTargets + Math.floor(b.stat('extraTargets')), arcTargets);
  let kills = (swings * maxT) / hitsToKill(perHit);

  const aoeTargets = Math.max(1, Math.min(10, alive / 10));
  if (b.has('cauda_clava')) kills += ((swings / 4) * aoeTargets) / hitsToKill(x.damage * 0.9 * pw('cauda_clava') * st.critMult);
  const cd = x.abilityCd;
  const lineTargets = Math.max(1, Math.min(8, alive / 10));
  if (b.dino.ability === 'charge') kills += lineTargets / hitsToKill(x.damage * AB.charge.coef * st.critMult) / cd;
  if (b.dino.ability === 'pounce') kills += lineTargets / hitsToKill(x.damage * AB.pounce.coef * st.critMult) / cd;
  if (b.dino.ability === 'roar') kills += Math.min(15, alive / 5) / hitsToKill(x.damage * AB.roar.coef) / cd;
  // Espinhos: com a horda em volta, cada janela de iFrames reflete um golpe corpo a corpo.
  if (b.has('espinhos')) kills += Math.min(1 / BALANCE.player.iFrames, alive / 20) / hitsToKill(thornsHit(b));
  if (b.has('impacto_sismico')) kills += Math.min(15, alive / 5) / hitsToKill(x.damage * 1.4 * pw('impacto_sismico')) / cd;
  if (b.has('matilha_fantasma')) {
    const pack = x.flags.has('packPersist');
    const count = Math.max(1, Math.floor(pw('matilha_fantasma'))) + (pack ? 1 : 0);
    const hits = pack ? count * (6 / 0.45) / 6 : count / 5;
    kills += hits / hitsToKill(x.damage * (pack ? 1.2 : 1.5) * b.stat('summonDamage'));
  }
  if (b.passives.has('pas_tri_tremor')) kills += Math.min(12, alive / 6) / hitsToKill(x.damage * 1.2 * st.critMult) / cd;
  if (b.passives.has('pas_raptor_alfa')) kills += 1 / 9 / hitsToKill(x.damage * 1.2 * b.stat('summonDamage'));
  if (b.has('colosso')) kills += Math.min(6, alive / 20) / 0.35 / hitsToKill(x.damage * 0.4 + mix.hp * 0.04);
  if (b.has('tempestade_de_sangue') && (b.has('dentes_serrilhados') || b.has('garras_serrilhadas'))) kills *= 1.35;
  return kills;
}

// ─────────────────────────── uma run ───────────────────────────
interface Snapshot {
  t: number; level: number; upgrades: number; alive: number; killsPerSec: number; spawnPerSec: number; killCap: number;
  damage: number; bossDps: number; ehp: number; maxHp: number; reduction: number; sustain: number;
  contactWorstDps: number; ttkCompy: number; ttkCarno: number;
}

interface RunResult {
  dino: DinoId; picker: Picker; snaps: Snapshot[]; final: Combat; eliteKilledAt: number | null;
  upgrades: string[]; primaryTag: string | null; bossWin: 'facetank' | 'dodge' | 'lose'; bossFightTime: number;
  /** Para a carreira: abates totais e segundos sobrevividos (derrota = morte durante o chefe, esquivando). */
  totalKills: number; elapsed: number;
}

function scoreBuild(b: Build, t: number): number {
  const s = singleTargetDps(b, { hp: 9500, armor: 30, boss: true }, 1, 3).dps;
  const k = killCapacity(b, Math.max(60, t), 60);
  const d = defense(b);
  const sus = sustain(b, 4, 3);
  return 0.4 * Math.log(s) + 0.35 * Math.log(k + 0.1) + 0.25 * Math.log(d.ehp) + 0.1 * Math.log(1 + sus);
}

function choose(b: Build, options: UpgradeDefinition[], picker: Picker, t: number): UpgradeDefinition {
  if (picker === 'random' || (picker === 'mixed' && Math.random() < 0.5)) return options[Math.floor(Math.random() * options.length)];
  let best = options[0];
  let bestS = -Infinity;
  for (const o of options) {
    const c = b.clone();
    c.acquire(o.id);
    const s = scoreBuild(c, t) + Math.random() * 0.01;
    if (s > bestS) { bestS = s; best = o; }
  }
  return best;
}

function simulateRun(dinoId: DinoId, picker: Picker, meta: MetaBonus[] = []): RunResult {
  const b = new Build(DINOSAURS[dinoId], meta);
  let totalKills = 0;
  const cfg = DIRECTOR_CONFIG;
  let level = 1, xp = 0, next = xpToNext(1);
  let alive = 0;
  let spawnAcc = 0;
  let eliteHp = 0, eliteKilledAt: number | null = null;
  const firedEvents = new Set<number>();
  const snaps: Snapshot[] = [];
  let lastKps = 0;

  const levelUp = (t: number, rare = false) => {
    const opts = b.roll(level, rare ? 'rare' : 'common');
    const pick = choose(b, opts, picker, t);
    b.acquire(pick.id);
  };

  for (let t = 0; t < cfg.bossTime; t++) {
    const ph = phaseAt(t);
    const mix = mixStats(ph.pool, t);
    // Spawns normais
    let spawned = 0;
    if (alive < ph.maxAlive) {
      spawnAcc += (ph.batch[0] + ph.batch[1]) / 2 / ph.interval;
      spawned = Math.min(Math.floor(spawnAcc), ph.maxAlive - alive);
      spawnAcc -= Math.floor(spawnAcc);
    }
    let xpSpawned = spawned * mix.xp;
    alive += spawned;
    // Eventos
    for (const ev of cfg.events) {
      if (firedEvents.has(ev.time) || t < ev.time) continue;
      firedEvents.add(ev.time);
      alive += ev.count;
    }
    // Elite
    if (t === cfg.eliteTime) eliteHp = ENEMIES.carnoAlpha.hp;
    if (eliteHp > 0) {
      const d = singleTargetDps(b, { hp: eliteHp, armor: ENEMIES.carnoAlpha.armor, boss: true }, lastKps, 3).dps * ASSUME.bossUptime * 0.5; // divide atenção com a horda
      eliteHp -= d;
      if (eliteHp <= 0) {
        eliteHp = 0; eliteKilledAt = t;
        xp += ENEMIES.carnoAlpha.xp * b.stat('xpGain') * ASSUME.pickupEfficiency;
        levelUp(t, true);
      }
    }
    // Mortes
    const cap = killCapacity(b, t, alive) * (eliteHp > 0 ? 0.5 : 1);
    const kills = Math.min(alive, cap);
    alive -= kills;
    lastKps = kills;
    totalKills += kills;
    xp += kills * mix.xp * b.stat('xpGain') * ASSUME.pickupEfficiency;
    while (xp >= next) { xp -= next; level++; next = xpToNext(level); levelUp(t); }

    if (t % 30 === 0 || t === cfg.bossTime - 1) {
      const def = defense(b);
      const G = ENEMIES.giganotosaurus;
      const st = singleTargetDps(b, { hp: G.hp, armor: G.armor, boss: true }, ASSUME.bossFightKillsPerSec, ASSUME.bossFightBleedingNearby);
      const x = derive(b);
      const hitVs = (id: EnemyId) => {
        const e = ENEMIES[id];
        const hp = e.hp * hpScale(t);
        return Math.ceil(hp / Math.max(1, st.hitDamage * armorFactor(e.armor))) / st.hitsPerSec;
      };
      snaps.push({
        t, level, upgrades: b.order.length, alive: Math.round(alive), killsPerSec: kills, spawnPerSec: spawned, killCap: cap,
        damage: x.rawDamage, bossDps: st.dps, ehp: def.ehp, maxHp: def.maxHp, reduction: def.reduction,
        sustain: sustain(b, kills, st.hitsPerSec),
        contactWorstDps: (1 / BALANCE.player.iFrames) * mix.contact * (1 - def.reduction),
        ttkCompy: hitVs('compy'), ttkCarno: hitVs('carnotaurus'),
      });
    }
    void xpSpawned;
  }

  // ── luta contra o chefe ──
  const def = defense(b);
  const G = ENEMIES.giganotosaurus;
  const A = ENEMIES.carnoAlpha;
  const rewardKps = RULES.summonsGiveRewards ? ASSUME.bossFightKillsPerSec : 0;
  const st = singleTargetDps(b, { hp: G.hp, armor: G.armor, boss: true }, rewardKps, ASSUME.bossFightBleedingNearby);
  const bossDps = st.dps * ASSUME.bossUptime;
  const bossTtk = G.hp / bossDps;
  const eliteTtk = A.hp / (singleTargetDps(b, { hp: A.hp, armor: A.armor, boss: true }, 1, 3).dps * ASSUME.bossUptime);
  const sus = sustain(b, rewardKps, st.hitsPerSec * ASSUME.bossUptime);
  const raw = bossAvgRawDps() * ASSUME.bossTankHitRate;
  const bossRed = def.reduction * (1 - RULES.bossPierce);
  const tank = raw * (1 - bossRed);
  const dodge = raw * (1 - ASSUME.bossDodge) * (1 - bossRed);
  /** Segundos até morrer recebendo `inc` dano/s (o enrage multiplica o dano depois de bossEnrageAt). */
  const survive = (inc: number) => {
    const before = inc - sus;
    const tBefore = before > 0 ? def.maxHp / before : Infinity;
    if (tBefore <= RULES.bossEnrageAt) return tBefore;
    const hpLeft = before > 0 ? def.maxHp - before * RULES.bossEnrageAt : def.maxHp;
    const after = inc * RULES.bossEnrageMult - sus;
    return after > 0 ? RULES.bossEnrageAt + hpLeft / after : Infinity;
  };
  const bossWin = survive(tank) >= bossTtk ? 'facetank' : survive(dodge) >= bossTtk ? 'dodge' : 'lose';
  const elapsed = cfg.bossTime + Math.min(bossTtk, survive(dodge));
  const bite = ENEMIES.giganotosaurus.params.biteDamage * (1 - bossRed);

  const final: Combat = {
    hitDamage: st.hitDamage, attacksPerSec: st.hitsPerSec, critMult: st.critMult, singleDps: st.dps,
    bossTtk, eliteTtk, maxHp: def.maxHp, reduction: def.reduction, ehp: def.ehp,
    sustainBoss: sus, bossIncomingTank: tank, bossIncomingDodge: dodge, hitsToDieBite: def.maxHp / bite,
  };
  return { dino: dinoId, picker, snaps, final, eliteKilledAt, upgrades: b.order.map((id) => `${id}:${b.level(id)}`), primaryTag: b.primaryTag, bossWin, bossFightTime: bossTtk, totalKills, elapsed };
}

// ─────────────────────────── estatísticas / saída ───────────────────────────
function pct(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
const med = (xs: number[]) => pct(xs, 0.5);
const f = (n: number, d = 0) => (Number.isFinite(n) ? n.toFixed(d) : '∞');

// ─────────────────────────── meta-progressão ───────────────────────────
/** XP de maestria total para estar exatamente no nível `level`. */
function xpForMastery(level: number): number {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += META_ECONOMY.mastery.xpPerLevel * l;
  return xp;
}

/** Perfis fixos: [nível de cada item da loja, nível de maestria]. */
const META_PROFILES: Record<string, [number, number]> = {
  nenhum: [0, 1], inicial: [1, 3], medio: [2, 6], max: [3, 10],
};

function profileLoadout(dino: DinoId, name: string): MetaBonus[] {
  const [items, mastery] = META_PROFILES[name] ?? META_PROFILES.nenhum;
  const shop = Object.fromEntries(SHOP[dino].map((i) => [i.id, items]));
  return loadoutFor(dino, shop, xpForMastery(mastery));
}

/**
 * Carreira: começa do zero e joga `maxRuns` runs seguidas com o mesmo dino, ganhando as recompensas
 * reais de cada run e comprando sempre o item mais barato disponível na loja.
 * Otimista: derrotas contam como morte durante o chefe (quem morre antes ganha menos).
 */
function simulateCareer(dino: DinoId, picker: Picker, maxRuns: number) {
  let fossils = 0;
  let masteryXp = 0;
  let spent = 0;
  const shop: Record<string, number> = {};
  let firstWin: number | null = null;
  let playTime = 0;
  let timeToFirstWin = 0;
  let masteryAtWin = 1;
  let spentAtWin = 0;
  const wins: boolean[] = [];
  for (let run = 1; run <= maxRuns; run++) {
    const r = simulateRun(dino, picker, loadoutFor(dino, shop, masteryXp));
    const win = r.bossWin !== 'lose';
    wins.push(win);
    playTime += r.elapsed;
    if (win && firstWin === null) {
      firstWin = run;
      timeToFirstWin = playTime;
      masteryAtWin = masteryLevel(masteryXp);
      spentAtWin = spent;
    }
    const reward = { elapsedTime: r.elapsed, kills: r.totalKills, eliteKilled: r.eliteKilledAt !== null, bossKilled: win };
    fossils += fossilsForRun(reward);
    masteryXp += masteryXpForRun(reward);
    // Compra gananciosa: item mais barato já liberado, até acabar o dinheiro.
    for (;;) {
      const lvlM = masteryLevel(masteryXp);
      const buyable = SHOP[dino]
        .map((i) => ({ i, lvl: shop[i.id] ?? 0 }))
        .filter(({ i, lvl }) => lvl < i.costs.length && lvlM >= i.mastery[lvl] && fossils >= i.costs[lvl])
        .sort((a, b) => a.i.costs[a.lvl] - b.i.costs[b.lvl]);
      if (!buyable.length) break;
      const { i, lvl } = buyable[0];
      fossils -= i.costs[lvl];
      spent += i.costs[lvl];
      shop[i.id] = lvl + 1;
    }
  }
  return { firstWin, timeToFirstWin, masteryAtWin, spentAtWin, wins };
}

function careerMain(careers: number, maxRuns: number): void {
  console.log(`\n=== Carreira: ${careers} carreiras × até ${maxRuns} runs por dino, começando sem nenhuma melhoria ===`);
  console.log('(vitória = vence o chefe esquivando 60% dos ataques; derrotas rendem como se morressem no chefe → estimativa otimista)');
  const buckets: [number, number][] = [[1, 3], [4, 6], [7, 10], [11, 15], [16, 25], [26, maxRuns]];
  const label: Record<Picker, string> = {
    smart: 'experiente (escolhas ótimas)', mixed: 'médio (50% ótimas / 50% aleatórias)', random: 'iniciante (escolhas aleatórias)',
  };
  for (const picker of ['smart', 'mixed', 'random'] as Picker[]) {
    console.log(`\n── jogador ${label[picker]} ──`);
    console.log(`dino           1ª vitória p25/p50/p75  nunca vence  horas até 1ª   maestria/gasto na 1ª   % de vitórias por faixa de runs`);
    for (const dino of DINO_ORDER) {
      const cs = Array.from({ length: careers }, () => simulateCareer(dino, picker, maxRuns));
      const won = cs.filter((c) => c.firstWin !== null);
      const firsts = cs.map((c) => c.firstWin ?? Infinity);
      const q = (p: number) => f(pct(firsts, p));
      const hours = won.length ? f(med(won.map((c) => c.timeToFirstWin)) / 3600, 1) : '—';
      const atWin = won.length ? `M${f(med(won.map((c) => c.masteryAtWin)))} / ${f(med(won.map((c) => c.spentAtWin)))}` : '—';
      const rates = buckets.map(([a, z]) => {
        const xs = cs.flatMap((c) => c.wins.slice(a - 1, z));
        return `${a}-${z}: ${f((xs.filter(Boolean).length / Math.max(1, xs.length)) * 100)}%`;
      }).join('  ');
      const never = f((1 - won.length / careers) * 100);
      console.log(`${DINOSAURS[dino].name.padEnd(14)} ${`${q(0.25)} / ${q(0.5)} / ${q(0.75)}`.padStart(20)}  ${never.padStart(10)}%  ${hours.padStart(12)}   ${atWin.padStart(20)}   ${rates}`);
    }
  }
}

/**
 * Análise: taxa de vitória por dino, build (tag principal) e mutação, com o jogador médio
 * (builds variadas). É correlação: mutações boas tendem a aparecer junto com outras boas.
 */
function analysisMain(runs: number, metaProfile: string): void {
  console.log(`\n=== Análise de vitórias · jogador médio · meta: ${metaProfile} · ${runs} runs por dino ===`);
  type Row = { dino: DinoId; win: boolean; tag: string; ups: string[] };
  const rows: Row[] = [];
  for (const dino of DINO_ORDER) {
    const meta = profileLoadout(dino, metaProfile);
    for (let i = 0; i < runs; i++) {
      const r = simulateRun(dino, 'mixed', meta);
      rows.push({ dino, win: r.bossWin !== 'lose', tag: r.primaryTag ?? '—', ups: r.upgrades.map((u) => u.split(':')[0]) });
    }
  }
  const rate = (xs: Row[]) => (xs.length ? xs.filter((r) => r.win).length / xs.length : 0);
  const base = rate(rows);
  console.log(`Geral: ${f(base * 100)}% de vitórias`);

  console.log('\n── Por dino ──');
  for (const d of DINO_ORDER) {
    const xs = rows.filter((r) => r.dino === d);
    console.log(`  ${DINOSAURS[d].name.padEnd(14)} ${f(rate(xs) * 100).padStart(3)}%`);
  }

  console.log('\n── Por build (tag principal no fim da run; mín. 3% das runs do dino) ──');
  for (const d of DINO_ORDER) {
    const xs = rows.filter((r) => r.dino === d);
    const tags = new Map<string, Row[]>();
    for (const r of xs) tags.set(r.tag, [...(tags.get(r.tag) ?? []), r]);
    const list = [...tags.entries()].filter(([, v]) => v.length >= xs.length * 0.03).sort((a, b) => rate(b[1]) - rate(a[1]));
    console.log(`  ${DINOSAURS[d].name}: ${list.map(([t, v]) => `${t} ${f(rate(v) * 100)}% (${f((v.length / xs.length) * 100)}% das runs)`).join(' · ')}`);
  }

  console.log('\n── Mutações: vitória com × sem (por dino; mín. 5% e máx. 95% de presença) ──');
  for (const d of DINO_ORDER) {
    const xs = rows.filter((r) => r.dino === d);
    const ids = new Set(xs.flatMap((r) => r.ups));
    const stats = [...ids].map((id) => {
      const withIt = xs.filter((r) => r.ups.includes(id));
      const without = xs.filter((r) => !r.ups.includes(id));
      return { id, share: withIt.length / xs.length, w: rate(withIt), wo: rate(without) };
    }).filter((s) => s.share >= 0.05 && s.share <= 0.95).sort((a, b) => (b.w - b.wo) - (a.w - a.wo));
    const fmt = (s: typeof stats[number]) => `${UPGRADE_BY_ID[s.id]?.name ?? s.id} ${f(s.w * 100)}% vs ${f(s.wo * 100)}% (${s.w - s.wo >= 0 ? '+' : ''}${f((s.w - s.wo) * 100)})`;
    console.log(`  ${DINOSAURS[d].name}`);
    console.log(`    melhores: ${stats.slice(0, 6).map(fmt).join(' · ')}`);
    console.log(`    piores:   ${stats.slice(-4).reverse().map(fmt).join(' · ')}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const runs = Number(args.find((a) => /^\d+$/.test(a)) ?? 300);
  const jsonIdx = args.indexOf('--json');
  const original = args.includes('--antes');
  if (original) applyOriginal();
  // --chefe hp,dano: substitui BALANCE.bossScaling (para varrer valores).
  const bossIdx = args.indexOf('--chefe');
  const [hpM, dmgM] = bossIdx >= 0
    ? (args[bossIdx + 1] ?? '1,1').split(',').map(Number)
    : original ? [1, 1] : [BALANCE.bossScaling.hpMult, BALANCE.bossScaling.damageMult];
  applyBossScaling(hpM, dmgM);
  if (bossIdx >= 0) console.log(`[varredura] chefe: ${ENEMIES.giganotosaurus.hp} HP, dano ×${dmgM}`);
  if (args.includes('--analise')) {
    const metaIdx = args.indexOf('--meta');
    analysisMain(runs, metaIdx >= 0 ? args[metaIdx + 1] ?? 'nenhum' : 'medio');
    return;
  }
  if (args.includes('--carreira')) {
    careerMain(Number(args.find((a) => /^\d+$/.test(a)) ?? 150), 40);
    return;
  }
  const metaIdx = args.indexOf('--meta');
  const metaProfile = metaIdx >= 0 ? args[metaIdx + 1] ?? 'nenhum' : 'nenhum';
  const out: Record<string, unknown> = { runs, original, assume: ASSUME, rules: RULES, results: {} };

  console.log(`\n=== DinoMutation — simulação de balanceamento${original ? ' [ANTES DA ETAPA 1]' : ' [ATUAL]'} (${runs} runs por dino/estilo) · meta: ${metaProfile} ===`);
  console.log(`Chefe: ${ENEMIES.giganotosaurus.hp} HP, armadura ${ENEMIES.giganotosaurus.armor}. DPS bruto do chefe: ${([1, 2, 3] as const).slice(0, RULES.bossPhases).map((ph) => `fase${ph} ${f(bossRawDps(ph), 1)}/s`).join(', ')}`);

  for (const picker of ['smart', 'mixed', 'random'] as Picker[]) {
    for (const dino of DINO_ORDER) {
      const meta = profileLoadout(dino, metaProfile);
      const rs = Array.from({ length: runs }, () => simulateRun(dino, picker, meta));
      const byT = new Map<number, Snapshot[]>();
      for (const r of rs) for (const s of r.snaps) byT.set(s.t, [...(byT.get(s.t) ?? []), s]);
      console.log(`\n── ${DINOSAURS[dino].name} · escolhas ${picker === 'smart' ? 'inteligentes' : picker === 'mixed' ? 'mistas (50/50)' : 'aleatórias'} ──`);
      console.log('tempo  nível  upg  vivos  mortes/s  capac.  dano  DPS-chefe  EHP   red%  cura/s  contato-max/s  TTK compy  TTK carno');
      const timeline: Record<string, number>[] = [];
      for (const [t, ss] of [...byT.entries()].sort((a, b) => a[0] - b[0])) {
        const row = {
          t, level: med(ss.map((s) => s.level)), upgrades: med(ss.map((s) => s.upgrades)), alive: med(ss.map((s) => s.alive)),
          kps: med(ss.map((s) => s.killsPerSec)), cap: med(ss.map((s) => s.killCap)), damage: med(ss.map((s) => s.damage)),
          bossDps: med(ss.map((s) => s.bossDps)), ehp: med(ss.map((s) => s.ehp)), red: med(ss.map((s) => s.reduction)),
          sustain: med(ss.map((s) => s.sustain)), contact: med(ss.map((s) => s.contactWorstDps)),
          ttkCompy: med(ss.map((s) => s.ttkCompy)), ttkCarno: med(ss.map((s) => s.ttkCarno)),
        };
        timeline.push(row);
        if (t % 60 === 0 || t === DIRECTOR_CONFIG.bossTime - 1) {
          console.log(`${String(Math.floor(t / 60)).padStart(2)}:${String(t % 60).padStart(2, '0')}  ${f(row.level).padStart(5)}  ${f(row.upgrades).padStart(3)}  ${f(row.alive).padStart(5)}  ${f(row.kps, 1).padStart(8)}  ${f(row.cap, 1).padStart(6)}  ${f(row.damage).padStart(4)}  ${f(row.bossDps).padStart(9)}  ${f(row.ehp).padStart(4)}  ${f(row.red * 100).padStart(4)}  ${f(row.sustain, 1).padStart(6)}  ${f(row.contact, 1).padStart(13)}  ${f(row.ttkCompy, 2).padStart(9)}  ${f(row.ttkCarno, 2).padStart(9)}`);
        }
      }
      const fin = rs.map((r) => r.final);
      const wins = { facetank: 0, dodge: 0, lose: 0 };
      for (const r of rs) wins[r.bossWin]++;
      const eliteKilled = rs.filter((r) => r.eliteKilledAt !== null).map((r) => r.eliteKilledAt! - DIRECTOR_CONFIG.eliteTime);
      const tags = new Map<string, number>();
      for (const r of rs) tags.set(r.primaryTag ?? '—', (tags.get(r.primaryTag ?? '—') ?? 0) + 1);
      const upCount = new Map<string, number>();
      for (const r of rs) for (const u of r.upgrades) { const id = u.split(':')[0]; upCount.set(id, (upCount.get(id) ?? 0) + 1); }
      const summary = {
        bossTtk: { p10: pct(fin.map((c) => c.bossTtk), 0.1), p50: med(fin.map((c) => c.bossTtk)), p90: pct(fin.map((c) => c.bossTtk), 0.9) },
        eliteTtkAtBoss: med(fin.map((c) => c.eliteTtk)),
        eliteKillSeconds: eliteKilled.length ? { p50: med(eliteKilled), p90: pct(eliteKilled, 0.9) } : null,
        eliteKillRate: eliteKilled.length / rs.length,
        bossDps: med(fin.map((c) => c.singleDps)), maxHp: med(fin.map((c) => c.maxHp)), reduction: med(fin.map((c) => c.reduction)),
        sustain: med(fin.map((c) => c.sustainBoss)), bossIncomingTank: med(fin.map((c) => c.bossIncomingTank)),
        bossIncomingDodge: med(fin.map((c) => c.bossIncomingDodge)), hitsToDieBite: med(fin.map((c) => c.hitsToDieBite)),
        wins: { facetank: wins.facetank / runs, dodge: wins.dodge / runs, lose: wins.lose / runs },
        primaryTags: Object.fromEntries([...tags.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / runs])),
        topUpgrades: [...upCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, v / runs]),
      };
      console.log(`Elite morta em ${f(summary.eliteKillRate * 100)}% das runs, mediana ${summary.eliteKillSeconds ? f(summary.eliteKillSeconds.p50) : '-'}s após surgir (dividindo atenção com a horda).`);
      console.log(`Chefe: TTK p10/p50/p90 = ${f(summary.bossTtk.p10)}s / ${f(summary.bossTtk.p50)}s / ${f(summary.bossTtk.p90)}s · DPS ${f(summary.bossDps)} · HP ${f(summary.maxHp)} · red ${f(summary.reduction * 100)}% · cura ${f(summary.sustain, 1)}/s`);
      console.log(`       dano recebido do chefe: tankando ${f(summary.bossIncomingTank, 1)}/s, esquivando ${f(summary.bossIncomingDodge, 1)}/s · mordidas p/ morrer ${f(summary.hitsToDieBite, 1)}`);
      console.log(`       vence tankando: ${f(summary.wins.facetank * 100)}% · só esquivando: ${f(summary.wins.dodge * 100)}% · perde: ${f(summary.wins.lose * 100)}%`);
      console.log(`       tag principal: ${Object.entries(summary.primaryTags).slice(0, 4).map(([k, v]) => `${k} ${f((v as number) * 100)}%`).join(', ')}`);
      (out.results as Record<string, unknown>)[`${dino}:${picker}`] = { timeline, summary };
    }
  }

  if (jsonIdx >= 0 && args[jsonIdx + 1]) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    import('node:fs').then((fs) => fs.writeFileSync(args[jsonIdx + 1], JSON.stringify(out, null, 2)));
  }
}

main();
