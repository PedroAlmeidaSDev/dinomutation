/**
 * Player-facing patch notes. The first entry is the current version: players who
 * haven't seen it yet get it once when they reach the menu (see MenuScene).
 * To publish a new version, add an entry at the TOP of the list.
 */

export interface PatchSection {
  title: string;
  /** Accent colour of the section heading. */
  color: string;
  items: string[];
}

export interface PatchNote {
  version: string;
  date: string;
  title: string;
  sections: PatchSection[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.2.0',
    date: '25/09/2026',
    title: 'O Covil e as Dificuldades',
    sections: [
      {
        title: 'COVIL',
        color: '#e0a0ff',
        items: [
          'Toda run rende FÓSSEIS, mesmo quando você perde. Gaste no COVIL (menu) em melhorias permanentes para cada dino: vida, dano, armadura, DNA e um item exclusivo.',
          'Cada dino ganha MAESTRIA jogando. Ela libera e melhora 3 passivas únicas e fortalece a habilidade especial (+dano, −recarga).',
        ],
      },
      {
        title: 'DIFICULDADES',
        color: '#8ad06a',
        items: [
          'Quatro dificuldades por dino: Filhote, Normal, Predador e Extinção. Comece no Filhote; vencer uma libera a próxima para aquele dino.',
          'Dificuldades maiores rendem mais Fósseis (até ×1,8), e a 1ª vitória em cada uma dá um bônus (60 a 400 Fósseis).',
          'Já venceu antes desta versão? O Normal já vem liberado para todos os dinos.',
        ],
      },
    ],
  },
  {
    version: '0.1.2',
    date: '25/09/2026',
    title: 'Ácido sob controle',
    sections: [
      {
        title: 'NOVIDADE',
        color: '#e0a0ff',
        items: [
          'Tabela de DANO POR FONTE no fim da run: veja quanto dano veio do ataque, da habilidade, de cada mutação e de cada veneno/sangramento.',
          'Botão COPIAR no fim da run: copia o resumo da run (dino, mutações e dano por fonte). Mande para a gente nos ajudar a balancear o jogo!',
        ],
      },
      {
        title: 'TRICERATOPS',
        color: '#9ab8d8',
        items: [
          'Dano base 25 → 23.',
        ],
      },
      {
        title: 'MUTAÇÕES',
        color: '#ffcf6a',
        items: [
          'Sangue Ácido: agora explode no máximo 1 vez por segundo (antes, podia disparar a cada golpe recebido).',
          'Fortaleza Viva: bônus de dano máximo +80% → +50%.',
        ],
      },
    ],
  },
  {
    version: '0.1.1',
    date: '25/09/2026',
    title: 'Equilíbrio dos Dinossauros',
    sections: [
      {
        title: 'TRICERATOPS',
        color: '#9ab8d8',
        items: [
          'Armadura inicial 40 → 25 · regeneração 1,2 → 0,9 · dano base 23 → 25.',
          'A chifrada empurra menos os inimigos (340 → 240).',
          'Investida: atordoa por 0,7s (era 1,1s) · recarga 7,5s (era 6,5s).',
        ],
      },
      {
        title: 'T-REX',
        color: '#ff9a6a',
        items: [
          'A mordida acerta até 3 inimigos (eram 2) e cobre uma área maior.',
          'Vida 170 → 180 · armadura 6 → 8.',
          'Rugido do Rei: dano 60% → 100% · recarga 10s → 8s.',
        ],
      },
      {
        title: 'VELOCIRAPTOR',
        color: '#6ad8ff',
        items: [
          'Vida 125 → 140 · armadura 5 → 10 · dano base 10 → 12.',
          'Pounce: dano 220% → 260% · recarga 3,5s → 3s.',
        ],
      },
      {
        title: 'MUTAÇÕES',
        color: '#ffcf6a',
        items: [
          'Espinhos: refletem 10 + 50% da armadura (era 80%).',
          'Fortaleza Viva: +0,8% de dano por ponto de armadura, até +80% (era +1,2% sem limite).',
        ],
      },
    ],
  },
];

export const CURRENT_PATCH: PatchNote = PATCH_NOTES[0];
