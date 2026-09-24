import type { StatKey } from '../game/components/StatsComponent';

export type DinoId = 'trex' | 'raptor' | 'triceratops';
export type AbilityId = 'roar' | 'pounce' | 'charge';
export type AttackKind = 'bite' | 'claw' | 'horn';

export interface AttackDef {
  kind: AttackKind;
  name: string;
  tags: string[];
  /** Multiplier over the player's damage stat. */
  coef: number;
  /** How many enemies inside the arc a single swing hits (Carnificina overrides). */
  maxTargets: number;
  knockback: number;
  /** Freeze-frame on hit (seconds). Makes heavy dinos feel heavy. */
  hitstop: number;
  shake: number;
}

export interface DinoDef {
  id: DinoId;
  name: string;
  title: string;
  description: string;
  texture: string;
  color: number;
  accentColor: number;
  radius: number;
  /** Movement acceleration (px/s²). Lower = heavier feel. */
  accel: number;
  stats: Partial<Record<StatKey, number>>;
  attack: AttackDef;
  ability: AbilityId;
  abilityName: string;
  abilityDescription: string;
  abilityTags: string[];
  /** Tags the dinosaur "starts with" — nudges upgrade offers toward its archetype. */
  innateTags: string[];
  /** 1..5 bars on the selection screen. */
  display: { health: number; speed: number; damage: number; attackSpeed: number };
  builds: string[];
}

export const DINOSAURS: Record<DinoId, DinoDef> = {
  trex: {
    id: 'trex',
    name: 'T-REX',
    title: 'O Rei Tirano',
    description: 'Mordidas devastadoras e lentas. Críticos, sangramento e execuções.',
    texture: 'dino_trex',
    color: 0x8a7440,
    accentColor: 0xd94a3a,
    radius: 24,
    accel: 1100,
    stats: {
      maxHealth: 170,
      damage: 30,
      attackSpeed: 1.0,
      moveSpeed: 165,
      armor: 6,
      critChance: 0.08,
      critDamage: 1.9,
      attackRange: 92,
      attackArc: 1.9,
      regen: 0.6,
    },
    attack: {
      kind: 'bite',
      name: 'Mordida',
      tags: ['bite', 'physical', 'melee'],
      coef: 1,
      maxTargets: 1,
      knockback: 170,
      hitstop: 0.03,
      shake: 0.003,
    },
    ability: 'roar',
    abilityName: 'Rugido do Rei',
    abilityDescription: 'Empurra e atordoa inimigos próximos. +40% de dano por 4s.',
    abilityTags: ['roar', 'aoe', 'stun'],
    innateTags: ['bite', 'crit', 'execute'],
    display: { health: 4, speed: 2, damage: 5, attackSpeed: 1 },
    builds: ['crítico', 'sangramento', 'execução', 'mordidas múltiplas'],
  },
  raptor: {
    id: 'raptor',
    name: 'VELOCIRAPTOR',
    title: 'A Lâmina Veloz',
    description: 'Extremamente rápido. Ataques em rajada, sangramento e matilhas espectrais.',
    texture: 'dino_raptor',
    color: 0xc47a3a,
    accentColor: 0x3fd0ff,
    radius: 16,
    accel: 3200,
    stats: {
      maxHealth: 125,
      damage: 10,
      attackSpeed: 3.2,
      moveSpeed: 255,
      armor: 5,
      critChance: 0.12,
      critDamage: 1.6,
      attackRange: 76,
      attackArc: 2.1,
      regen: 0.6,
    },
    attack: {
      kind: 'claw',
      name: 'Garras',
      tags: ['claw', 'physical', 'melee'],
      coef: 1,
      maxTargets: 1,
      knockback: 95,
      hitstop: 0,
      shake: 0,
    },
    ability: 'pounce',
    abilityName: 'Pounce',
    abilityDescription: 'Salta na direção do movimento, rasgando todos no caminho.',
    abilityTags: ['dash', 'pounce', 'claw'],
    innateTags: ['claw', 'speed', 'summon'],
    display: { health: 1, speed: 5, damage: 1, attackSpeed: 5 },
    builds: ['attack speed', 'sangramento', 'matilha', 'mobilidade'],
  },
  triceratops: {
    id: 'triceratops',
    name: 'TRICERATOPS',
    title: 'A Fortaleza',
    description: 'Tanque blindado. Armadura, espinhos, atordoamento e investidas.',
    texture: 'dino_tri',
    color: 0x5f7fa3,
    accentColor: 0xe0c070,
    radius: 26,
    accel: 800,
    stats: {
      maxHealth: 240,
      damage: 23,
      attackSpeed: 1.05,
      moveSpeed: 140,
      armor: 40,
      critChance: 0.05,
      critDamage: 1.5,
      attackRange: 84,
      attackArc: 1.8,
      regen: 1.2,
    },
    attack: {
      kind: 'horn',
      name: 'Chifrada',
      tags: ['horn', 'physical', 'melee', 'impact'],
      coef: 1,
      maxTargets: 4,
      knockback: 340,
      hitstop: 0.025,
      shake: 0.0025,
    },
    ability: 'charge',
    abilityName: 'Investida',
    abilityDescription: 'Dispara para frente, esmagando, empurrando e atordoando.',
    abilityTags: ['dash', 'charge', 'impact', 'stun'],
    innateTags: ['armor', 'horn', 'impact'],
    display: { health: 5, speed: 1, damage: 3, attackSpeed: 2 },
    builds: ['armadura', 'espinhos', 'stun', 'investidas'],
  },
};

export const DINO_ORDER: DinoId[] = ['trex', 'raptor', 'triceratops'];
