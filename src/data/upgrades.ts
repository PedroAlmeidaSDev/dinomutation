import type { UpgradeDefinition } from '../game/upgrades/UpgradeTypes';

/**
 * Every mutation in the game. Adding a new one is normally just a new entry here
 * (plus, for brand-new mechanics, a handler in UpgradeEffects.ts).
 *
 * Numeric values are per level: effects scale with upgrade "power" (= level, ×1.5 with Evolução Apex).
 */
export const UPGRADES: UpgradeDefinition[] = [
  // ───────────── BITE / BLEED ─────────────
  {
    id: 'dentes_serrilhados', name: 'Dentes Serrilhados', rarity: 'common', maxLevel: 3,
    tags: ['bite', 'bleed'],
    description: 'Suas mordidas causam 2 acúmulos de Sangramento (+2 por nível).',
    requires: { attackTags: ['bite'] },
    effects: [
      { type: 'statusOnHit', status: 'bleed', chance: 1, stacks: 2, tags: ['bite'] },
      { type: 'flag', flag: 'vfx_bleed' },
    ],
    visual: ['bleed'],
  },
  {
    id: 'garras_serrilhadas', name: 'Garras Serrilhadas', rarity: 'common', maxLevel: 3,
    tags: ['claw', 'bleed'],
    description: 'Ataques de garra têm 50% de chance de aplicar Sangramento (+50% e +1 acúmulo por nível).',
    requires: { attackTags: ['claw'] },
    effects: [
      { type: 'statusOnHit', status: 'bleed', chance: 0.5, stacks: 1, tags: ['claw'] },
      { type: 'flag', flag: 'vfx_bleed' },
    ],
    visual: ['bleed'],
  },
  {
    id: 'hemorragia', name: 'Hemorragia', rarity: 'common', maxLevel: 3,
    tags: ['bleed'],
    description: 'Sangramento causa +35% de dano.',
    requires: { ownedTags: ['bleed'] },
    effects: [{ type: 'stat', stat: 'bleedDamage', mode: 'add', value: 0.35 }],
  },
  {
    id: 'sangue_quente', name: 'Sangue Quente', rarity: 'common', maxLevel: 3,
    tags: ['bleed'],
    description: '+4% de dano para cada inimigo sangrando por perto (máx. +60%).',
    requires: { ownedTags: ['bleed'] },
    effects: [
      { type: 'trigger', trigger: 'tick', effect: 'nearbyStatusBuff', params: { status: 'bleed', radius: 300, per: 0.04, max: 0.6, stat: 'damage' } },
    ],
  },
  {
    id: 'hemofagia', name: 'Hemofagia', rarity: 'rare', maxLevel: 3,
    tags: ['bleed', 'heal'],
    description: 'Causar dano a inimigos sangrando recupera 1.2 de vida (recarga interna de 0.2s).',
    requires: { ownedTags: ['bleed'] },
    effects: [
      { type: 'trigger', trigger: 'onHit', effect: 'healOnStatusHit', params: { status: 'bleed', amount: 1.2, icd: 0.2 } },
    ],
  },
  {
    id: 'mandibula_brutal', name: 'Mandíbula Brutal', rarity: 'common', maxLevel: 3,
    tags: ['bite', 'aoe'],
    description: 'Mordidas maiores: +15% alcance, +20% arco e +12% de dano de mordida.',
    requires: { attackTags: ['bite'] },
    effects: [
      { type: 'stat', stat: 'attackRange', mode: 'mult', value: 0.15 },
      { type: 'stat', stat: 'attackArc', mode: 'mult', value: 0.2 },
      { type: 'stat', stat: 'dmg_bite', mode: 'add', value: 0.12 },
    ],
    visual: ['jaw'],
  },
  {
    id: 'mordida_dupla', name: 'Mordida Dupla', rarity: 'rare', maxLevel: 3,
    tags: ['bite', 'multi'],
    description: '25% de chance de repetir automaticamente a mordida.',
    requires: { attackTags: ['bite'] },
    effects: [{ type: 'stat', stat: 'repeatChance', mode: 'add', value: 0.25 }],
  },
  {
    id: 'golpes_gemeos', name: 'Golpes Gêmeos', rarity: 'rare', maxLevel: 3,
    tags: ['claw', 'horn', 'multi'],
    description: '20% de chance de repetir o ataque básico. +1 alvo por ataque.',
    requires: { attackTags: ['claw', 'horn'] },
    effects: [
      { type: 'stat', stat: 'repeatChance', mode: 'add', value: 0.2 },
      { type: 'stat', stat: 'extraTargets', mode: 'add', value: 1 },
    ],
  },

  // ───────────── CRIT / EXECUTE ─────────────
  {
    id: 'olhos_predador', name: 'Olhos de Predador', rarity: 'common', maxLevel: 5,
    tags: ['crit'],
    description: '+6% de chance de crítico.',
    effects: [{ type: 'stat', stat: 'critChance', mode: 'add', value: 0.06 }],
    visual: ['crit'],
  },
  {
    id: 'presas_letais', name: 'Presas Letais', rarity: 'common', maxLevel: 3,
    tags: ['crit'],
    description: '+35% de dano crítico.',
    effects: [{ type: 'stat', stat: 'critDamage', mode: 'add', value: 0.35 }],
  },
  {
    id: 'instinto_assassino', name: 'Instinto Assassino', rarity: 'common', maxLevel: 3,
    tags: ['crit', 'execute'],
    description: '+20% de chance de crítico contra inimigos abaixo de 50% de vida. +3% crítico.',
    effects: [
      { type: 'trigger', trigger: 'modifyDamage', effect: 'lowHpCrit', params: { threshold: 0.5, bonus: 0.2 } },
      { type: 'stat', stat: 'critChance', mode: 'add', value: 0.03 },
    ],
  },
  {
    id: 'execucao', name: 'Execução', rarity: 'common', maxLevel: 3,
    tags: ['execute'],
    description: '+35% de dano em inimigos abaixo de 30% de vida. Inimigos comuns abaixo de 6% (+6%/nível) morrem na hora.',
    effects: [
      { type: 'trigger', trigger: 'modifyDamage', effect: 'execute', params: { threshold: 0.3, bonus: 0.35, instakill: 0.06 } },
    ],
  },

  // ───────────── SPEED / FRENZY ─────────────
  {
    id: 'predador_frenetico', name: 'Predador Frenético', rarity: 'common', maxLevel: 3,
    tags: ['kill', 'speed'],
    description: 'Cada abate concede +4% de vel. de ataque por 3s (acumula até 10x).',
    effects: [
      { type: 'trigger', trigger: 'onKill', effect: 'stackBuff', params: { stat: 'attackSpeed', perStack: 0.04, max: 10, duration: 3 } },
      { type: 'trigger', trigger: 'tick', effect: 'stackDecay' },
    ],
  },
  {
    id: 'frenesi', name: 'Frenesi', rarity: 'common', maxLevel: 3,
    tags: ['speed'],
    description: 'Cada ataque consecutivo concede +2.5% de vel. de ataque (até 12x). Some se parar de atacar.',
    effects: [
      { type: 'trigger', trigger: 'onAttack', effect: 'stackBuff', params: { stat: 'attackSpeed', perStack: 0.025, max: 12, duration: 1.5 } },
      { type: 'trigger', trigger: 'tick', effect: 'stackDecay' },
    ],
  },
  {
    id: 'reflexos_rapidos', name: 'Reflexos Rápidos', rarity: 'common', maxLevel: 5,
    tags: ['speed'],
    description: '+12% de velocidade de ataque.',
    effects: [{ type: 'stat', stat: 'attackSpeed', mode: 'mult', value: 0.12 }],
  },
  {
    id: 'adrenalina', name: 'Adrenalina', rarity: 'common', maxLevel: 3,
    tags: ['speed'],
    description: 'Com menos de 30% de vida: +25% movimento e +30% vel. de ataque.',
    effects: [
      { type: 'trigger', trigger: 'tick', effect: 'lowHpBuff', params: { threshold: 0.3, moveSpeed: 0.25, attackSpeed: 0.3 } },
    ],
  },
  {
    id: 'metabolismo_acelerado', name: 'Metabolismo Acelerado', rarity: 'common', maxLevel: 3,
    tags: ['speed', 'heal'],
    description: '+8% de movimento e +1 de regeneração de vida por segundo.',
    effects: [
      { type: 'stat', stat: 'moveSpeed', mode: 'mult', value: 0.08 },
      { type: 'stat', stat: 'regen', mode: 'add', value: 1 },
    ],
  },
  {
    id: 'ossos_leves', name: 'Ossos Leves', rarity: 'common', maxLevel: 2,
    tags: ['speed'],
    description: '+18% de movimento e -5% de recarga da habilidade, mas -6 de armadura.',
    effects: [
      { type: 'stat', stat: 'moveSpeed', mode: 'mult', value: 0.18 },
      { type: 'stat', stat: 'cooldownReduction', mode: 'add', value: 0.05 },
      { type: 'stat', stat: 'armor', mode: 'add', value: -6 },
    ],
  },
  {
    id: 'cacador_voraz', name: 'Caçador Voraz', rarity: 'common', maxLevel: 3,
    tags: ['kill', 'ability'],
    description: 'Cada abate reduz a recarga da habilidade especial em 0.2s.',
    effects: [{ type: 'trigger', trigger: 'onKill', effect: 'reduceCooldown', params: { seconds: 0.2 } }],
  },

  // ───────────── ARMOR / THORNS / IMPACT ─────────────
  {
    id: 'carapaca_reforcada', name: 'Carapaça Reforçada', rarity: 'common', maxLevel: 5,
    tags: ['armor'],
    description: '+10 de armadura.',
    effects: [{ type: 'stat', stat: 'armor', mode: 'add', value: 10 }],
    visual: ['plates'],
  },
  {
    id: 'espinhos', name: 'Espinhos', rarity: 'common', maxLevel: 3,
    tags: ['armor', 'thorns', 'reflect'],
    description: 'Inimigos que causam dano corpo a corpo recebem 10 + 80% da sua Armadura como dano.',
    effects: [{ type: 'trigger', trigger: 'onDamageTaken', effect: 'thorns', params: { flat: 10, armorScale: 0.8 } }],
    visual: ['spikes'],
  },
  {
    id: 'placas_osseas', name: 'Placas Ósseas', rarity: 'common', maxLevel: 3,
    tags: ['armor'],
    description: 'Ao receber dano, ganha 12% de redução de dano por 3s. +4 armadura.',
    effects: [
      { type: 'trigger', trigger: 'onDamageTaken', effect: 'timedStat', params: { stat: 'damageReduction', mode: 'add', value: 0.12, duration: 3 } },
      { type: 'stat', stat: 'armor', mode: 'add', value: 4 },
    ],
    visual: ['plates'],
  },
  {
    id: 'couro_espesso', name: 'Couro Espesso', rarity: 'common', maxLevel: 5,
    tags: ['health'],
    description: '+30 de vida máxima e +0.3 de regeneração.',
    effects: [
      { type: 'stat', stat: 'maxHealth', mode: 'add', value: 30 },
      { type: 'stat', stat: 'regen', mode: 'add', value: 0.3 },
    ],
  },
  {
    id: 'chifres_pesados', name: 'Chifres Pesados', rarity: 'common', maxLevel: 3,
    tags: ['horn', 'stun', 'impact'],
    description: 'Chifradas têm 15% de chance de atordoar e causam +15% de dano.',
    requires: { attackTags: ['horn'] },
    effects: [
      { type: 'statusOnHit', status: 'stun', chance: 0.15, stacks: 1, duration: 0.8, tags: ['horn'] },
      { type: 'stat', stat: 'dmg_horn', mode: 'add', value: 0.15 },
    ],
    visual: ['horns'],
  },
  {
    id: 'impacto_sismico', name: 'Impacto Sísmico', rarity: 'common', maxLevel: 3,
    tags: ['charge', 'aoe', 'stun'],
    description: 'Ao fim de uma investida/salto, cria uma onda de choque que causa 140% de dano e atordoa.',
    requires: { abilityTags: ['dash'] },
    effects: [
      { type: 'trigger', trigger: 'onDashEnd', effect: 'aoeBurst', params: { radius: 150, coef: 1.4, stun: 0.8, knockback: 420, color: 0xffc070, particles: 'dust', tag: 'impact' } },
    ],
  },
  {
    id: 'massa_imparavel', name: 'Massa Imparável', rarity: 'common', maxLevel: 3,
    tags: ['charge', 'impact'],
    description: 'Mover-se na mesma direção acumula Ímpeto: investidas/saltos causam até +100% de dano. +4% movimento.',
    requires: { abilityTags: ['dash'] },
    effects: [
      { type: 'trigger', trigger: 'modifyDamage', effect: 'momentumBonus', params: { bonus: 1 } },
      { type: 'stat', stat: 'moveSpeed', mode: 'mult', value: 0.04 },
    ],
  },
  {
    id: 'concussao', name: 'Concussão', rarity: 'common', maxLevel: 3,
    tags: ['stun'],
    description: 'Inimigos atordoados recebem +30% de dano.',
    requires: { ownedTags: ['stun'] },
    effects: [{ type: 'trigger', trigger: 'modifyDamage', effect: 'bonusVsStatus', params: { status: 'stun', bonus: 0.3 } }],
  },
  {
    id: 'cauda_clava', name: 'Cauda Clava', rarity: 'common', maxLevel: 3,
    tags: ['tail', 'aoe', 'impact'],
    description: 'A cada 4 ataques, gira a cauda causando 90% de dano ao redor e empurrando inimigos.',
    effects: [{ type: 'trigger', trigger: 'onAttack', effect: 'tailSwipe', params: { every: 4, radius: 115, coef: 0.9, knockback: 380 } }],
  },

  // ───────────── POISON / FEAR / MISC ─────────────
  {
    id: 'glandulas_venenosas', name: 'Glândulas Venenosas', rarity: 'common', maxLevel: 3,
    tags: ['poison'],
    description: 'Ataques têm 35% de chance de aplicar 2 acúmulos de Veneno.',
    effects: [{ type: 'statusOnHit', status: 'poison', chance: 0.35, stacks: 2 }],
    visual: ['acid'],
  },
  {
    id: 'toxinas_corrosivas', name: 'Toxinas Corrosivas', rarity: 'common', maxLevel: 3,
    tags: ['poison'],
    description: 'Inimigos envenenados recebem +25% de dano. Veneno causa +30% de dano.',
    requires: { ownedTags: ['poison'] },
    effects: [
      { type: 'trigger', trigger: 'modifyDamage', effect: 'bonusVsStatus', params: { status: 'poison', bonus: 0.25 } },
      { type: 'stat', stat: 'poisonDamage', mode: 'add', value: 0.3 },
    ],
  },
  {
    id: 'sangue_acido', name: 'Sangue Ácido', rarity: 'rare', maxLevel: 3,
    tags: ['poison', 'aoe'],
    description: 'Ao receber dano, 50% de chance de explodir em ácido: 120% de dano em área + 3 de Veneno.',
    effects: [
      { type: 'trigger', trigger: 'onDamageTaken', effect: 'aoeBurst', params: { chance: 0.5, radius: 150, coef: 1.2, poison: 3, color: 0x90ff40, particles: 'poison', tag: 'poison' } },
    ],
    visual: ['acid'],
  },
  {
    id: 'presenca_aterrorizante', name: 'Presença Aterrorizante', rarity: 'common', maxLevel: 2,
    tags: ['fear', 'ability'],
    description: 'Usar a habilidade especial causa Medo em inimigos próximos por 1.8s.',
    effects: [{ type: 'trigger', trigger: 'onAbilityUse', effect: 'fearPulse', params: { radius: 270, duration: 1.8 } }],
  },
  {
    id: 'predador_alfa', name: 'Predador Alfa', rarity: 'rare', maxLevel: 3,
    tags: ['fear', 'kill'],
    description: 'Abates têm 15% de chance de aterrorizar inimigos próximos por 2s.',
    effects: [{ type: 'trigger', trigger: 'onKill', effect: 'fearOnKill', params: { chance: 0.15, radius: 180, duration: 2 } }],
  },
  {
    id: 'voracidade', name: 'Voracidade', rarity: 'common', maxLevel: 3,
    tags: ['heal', 'kill'],
    description: 'Cada abate recupera 1 de vida.',
    effects: [{ type: 'trigger', trigger: 'onKill', effect: 'healFlat', params: { amount: 1 } }],
  },
  {
    id: 'musculos_densos', name: 'Músculos Densos', rarity: 'common', maxLevel: 5,
    tags: ['physical'],
    description: '+12% de dano.',
    effects: [{ type: 'stat', stat: 'damage', mode: 'mult', value: 0.12 }],
  },
  {
    id: 'faro_agucado', name: 'Faro Aguçado', rarity: 'common', maxLevel: 3,
    tags: ['utility'],
    description: '+40% de alcance de coleta de DNA e +10% de DNA obtido.',
    effects: [
      { type: 'stat', stat: 'pickupRange', mode: 'mult', value: 0.4 },
      { type: 'stat', stat: 'xpGain', mode: 'add', value: 0.1 },
    ],
  },
  {
    id: 'gigantismo', name: 'Gigantismo', rarity: 'common', maxLevel: 3,
    tags: ['size'],
    description: '+15% tamanho, +20% vida, +12% dano e +10% alcance, mas -6% movimento.',
    effects: [
      { type: 'stat', stat: 'size', mode: 'add', value: 0.15 },
      { type: 'stat', stat: 'maxHealth', mode: 'mult', value: 0.2 },
      { type: 'stat', stat: 'damage', mode: 'mult', value: 0.12 },
      { type: 'stat', stat: 'attackRange', mode: 'mult', value: 0.1 },
      { type: 'stat', stat: 'moveSpeed', mode: 'mult', value: -0.06 },
    ],
  },
  {
    id: 'mutacao_instavel', name: 'Mutação Instável', rarity: 'rare', maxLevel: 3,
    tags: ['mutation'],
    description: '+30% de dano, mas -12% de vida máxima.',
    effects: [
      { type: 'stat', stat: 'damage', mode: 'mult', value: 0.3 },
      { type: 'stat', stat: 'maxHealth', mode: 'mult', value: -0.12 },
    ],
    visual: ['mutation'],
  },
  {
    id: 'matilha_fantasma', name: 'Matilha Fantasma', rarity: 'rare', maxLevel: 3,
    tags: ['summon', 'claw'],
    description: 'A cada 5s invoca um raptor espectral que ataca um inimigo (150% de dano). Mais raptors por nível.',
    effects: [
      { type: 'trigger', trigger: 'tick', effect: 'summonGhosts', params: { interval: 5, coef: 1.5 } },
    ],
  },

  // ───────────── LEGENDARY: change how the build works ─────────────
  {
    id: 'carnificina', name: 'Carnificina', rarity: 'legendary', maxLevel: 1,
    tags: ['bite', 'claw', 'aoe'],
    description: 'Seus ataques básicos passam a atingir TODOS os inimigos dentro do arco. +25% arco.',
    requires: { attackTags: ['bite', 'claw'] },
    effects: [
      { type: 'flag', flag: 'carnage' },
      { type: 'stat', stat: 'attackArc', mode: 'mult', value: 0.25 },
    ],
    visual: ['jaw'],
  },
  {
    id: 'tempestade_de_sangue', name: 'Tempestade de Sangue', rarity: 'legendary', maxLevel: 1,
    tags: ['bleed', 'aoe'],
    description: 'Inimigos que morrem sangrando explodem, causando dano pelos acúmulos e espalhando 60% do Sangramento.',
    requires: { ownedTags: ['bleed'] },
    effects: [{ type: 'trigger', trigger: 'onKill', effect: 'bleedExplosion', params: { radius: 160, perStack: 0.6, spread: 0.6 } }],
  },
  {
    id: 'matilha', name: 'Matilha', rarity: 'legendary', maxLevel: 1,
    tags: ['summon', 'claw'],
    description: 'Raptors espectrais permanecem por 6s atacando vários inimigos, e surge +1 por invocação.',
    requires: { upgrades: ['matilha_fantasma'] },
    effects: [
      { type: 'flag', flag: 'packPersist' },
      { type: 'stat', stat: 'summonDamage', mode: 'add', value: 0.25 },
    ],
  },
  {
    id: 'fortaleza_viva', name: 'Fortaleza Viva', rarity: 'legendary', maxLevel: 1,
    tags: ['armor'],
    description: 'Cada ponto de Armadura concede +1.2% de dano. +10 armadura.',
    requires: { ownedTags: ['armor'] },
    effects: [
      { type: 'trigger', trigger: 'modifyDamage', effect: 'armorToDamage', params: { perArmor: 0.012 } },
      { type: 'stat', stat: 'armor', mode: 'add', value: 10 },
    ],
    visual: ['plates', 'spikes'],
  },
  {
    id: 'colosso', name: 'Colosso', rarity: 'legendary', maxLevel: 1,
    tags: ['size', 'armor'],
    description: '+30% tamanho e +40% vida. Inimigos comuns que encostam em você são esmagados continuamente.',
    effects: [
      { type: 'stat', stat: 'size', mode: 'add', value: 0.3 },
      { type: 'stat', stat: 'maxHealth', mode: 'mult', value: 0.4 },
      { type: 'trigger', trigger: 'tick', effect: 'colossusCrush', params: { interval: 0.35, coef: 0.4, hpPercent: 0.04 } },
    ],
    visual: ['colossus'],
  },
  {
    id: 'evolucao_apex', name: 'Evolução Apex', rarity: 'legendary', maxLevel: 1,
    tags: ['mutation'],
    description: 'Todos os upgrades com a TAG PRINCIPAL da sua build ficam 50% mais fortes.',
    requires: { minUpgrades: 5 },
    effects: [{ type: 'flag', flag: 'apex' }],
  },

  // ───────────── Fallback consumables ─────────────
  {
    id: 'carne_fresca', name: 'Carne Fresca', rarity: 'common', maxLevel: 99, consumable: true,
    tags: ['heal'],
    description: 'Recupera 40% da vida.',
    effects: [{ type: 'heal', percent: 0.4 }],
  },
  {
    id: 'ovo_vital', name: 'Ovo Vital', rarity: 'common', maxLevel: 99, consumable: true,
    tags: ['health'],
    description: '+15 de vida máxima.',
    effects: [{ type: 'stat', stat: 'maxHealth', mode: 'add', value: 15 }],
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDefinition> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** Human-readable tag names shown on cards. */
export const TAG_LABELS: Record<string, string> = {
  bite: 'BITE', claw: 'CLAW', horn: 'HORN', bleed: 'BLEED', crit: 'CRIT', execute: 'EXECUTE',
  speed: 'SPEED', kill: 'KILL', armor: 'ARMOR', thorns: 'THORNS', reflect: 'REFLECT', charge: 'CHARGE',
  impact: 'IMPACT', stun: 'STUN', aoe: 'AOE', tail: 'TAIL', poison: 'POISON', fear: 'FEAR', heal: 'HEAL',
  physical: 'PHYSICAL', utility: 'UTILITY', size: 'SIZE', mutation: 'MUTATION', summon: 'SUMMON',
  multi: 'MULTI', ability: 'ABILITY', health: 'HEALTH',
};

/** Tag colours used in the UI and for the build aura. */
export const TAG_COLORS: Record<string, number> = {
  bite: 0xff8a5a, claw: 0xffb070, horn: 0xe8d08a, bleed: 0xff3048, crit: 0xffd23a, execute: 0xff5a5a,
  speed: 0x5ae0ff, kill: 0xff7aa0, armor: 0x9ab8d8, thorns: 0xd8c890, reflect: 0xc0c0ff, charge: 0xffa040,
  impact: 0xffc070, stun: 0xfff070, aoe: 0xffa0ff, tail: 0xc0a070, poison: 0x90ff40, fear: 0xb070ff,
  heal: 0x70ff90, physical: 0xe0e0e0, utility: 0xa0e0c0, size: 0xd09060, mutation: 0xd040ff,
  summon: 0x60e0ff, multi: 0xffe0a0, ability: 0x80c0ff, health: 0x70ff90,
};
