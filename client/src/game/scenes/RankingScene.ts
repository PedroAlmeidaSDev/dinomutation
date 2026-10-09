import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_BY_ID, type DifficultyId } from '../../data/difficulty';
import { DINOSAURS, DINO_ORDER, type DinoId } from '../../data/dinosaurs';
import { fetchLeaderboard, type Leaderboard, type LeaderboardEntry } from '../../net/leaderboard';
import { formatTime } from '../../utils/math';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { centerDesign } from '../ui/layout';
import { COLORS, button, text, title } from '../ui/theme';

/** undefined = no filter ("todos"). */
const DINO_FILTER: (DinoId | undefined)[] = [undefined, ...DINO_ORDER];
const DIFFICULTY_FILTER: (DifficultyId | undefined)[] = [undefined, ...DIFFICULTIES.map((d) => d.id)];
const TOP = 222;
const ROW_H = 19;
const COLS = { rank: 250, name: 300, time: 640, dino: 680, difficulty: 860, era: 1030 };

/** Global ranking of the longest survival times (GET /api/leaderboard). */
export class RankingScene extends Phaser.Scene {
  private dinoIndex = 0;
  private difficultyIndex = 0;
  /** Only the latest request may draw (filters can change while one is in flight). */
  private request = 0;
  private dinoLabel!: Phaser.GameObjects.Text;
  private difficultyLabel!: Phaser.GameObjects.Text;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super('Ranking');
  }

  create(): void {
    this.dinoIndex = 0;
    this.difficultyIndex = 0;
    this.request = 0;
    centerDesign(this, [
      this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'ground').setAlpha(0.5),
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.8),
    ]);
    title(this, GAME_WIDTH / 2, 50, 'RANKING', 38).setOrigin(0.5);
    text(this, GAME_WIDTH / 2, 92, 'Maiores tempos sobrevividos', 16, COLORS.muted).setOrigin(0.5);

    this.dinoLabel = this.selector(GAME_WIDTH / 2 - 230, 140, (dir) => {
      this.dinoIndex = wrap(this.dinoIndex + dir, DINO_FILTER.length);
      this.loadBoard();
    });
    this.difficultyLabel = this.selector(GAME_WIDTH / 2 + 230, 140, (dir) => {
      this.difficultyIndex = wrap(this.difficultyIndex + dir, DIFFICULTY_FILTER.length);
      this.loadBoard();
    });
    this.header();
    this.content = this.add.container(0, 0);

    button(this, 150, GAME_HEIGHT - 40, 'VOLTAR', () => this.scene.start('Menu'), { width: 200, height: 50, fontSize: 18, ghost: true });
    this.input.keyboard?.once('keydown-ESC', () => this.scene.start('Menu'));
    this.loadBoard();
    this.cameras.main.fadeIn(250);
  }

  private selector(x: number, y: number, onChange: (dir: number) => void): Phaser.GameObjects.Text {
    const arrow = (dx: number, glyph: string, dir: number) =>
      text(this, x + dx, y, glyph, 22, COLORS.accentText, true)
        .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => onChange(dir));
    arrow(-150, '◀', -1);
    arrow(150, '▶', 1);
    return text(this, x, y, '', 17, COLORS.text, true).setOrigin(0.5);
  }

  private header(): void {
    const y = TOP - 26;
    const cell = (x: number, label: string, right = false) => {
      const t = text(this, x, y, label, 13, COLORS.muted, true);
      if (right) t.setOrigin(1, 0);
    };
    cell(COLS.rank, '#');
    cell(COLS.name, 'JOGADOR');
    cell(COLS.time, 'TEMPO', true);
    cell(COLS.dino, 'DINO');
    cell(COLS.difficulty, 'DIFICULDADE');
    cell(COLS.era, 'ERA');
  }

  /** Named loadBoard (not load): Phaser.Scene already has a public `load` (the LoaderPlugin). */
  private loadBoard(): void {
    const dino = DINO_FILTER[this.dinoIndex];
    const difficulty = DIFFICULTY_FILTER[this.difficultyIndex];
    this.dinoLabel.setText(dino ? DINOSAURS[dino].name : 'TODOS OS DINOS');
    this.difficultyLabel.setText(difficulty ? DIFFICULTY_BY_ID[difficulty].name.toUpperCase() : 'TODAS AS DIFICULDADES');
    const request = ++this.request;
    this.showStatus('Carregando…');
    fetchLeaderboard({ dino, difficulty })
      .then((board) => {
        if (request === this.request && this.sys.isActive()) this.render(board);
      })
      .catch(() => {
        if (request === this.request && this.sys.isActive()) this.showError();
      });
  }

  private showStatus(message: string): void {
    this.content.removeAll(true);
    this.content.add(text(this, GAME_WIDTH / 2, 400, message, 18, COLORS.muted, true).setOrigin(0.5));
  }

  private showError(): void {
    this.showStatus('Sem conexão com o servidor.');
    this.content.add(button(this, GAME_WIDTH / 2, 460, 'TENTAR DE NOVO', () => this.loadBoard(), {
      width: 260, height: 46, fontSize: 16, ghost: true,
    }));
  }

  private render(board: Leaderboard): void {
    this.content.removeAll(true);
    if (board.entries.length === 0) {
      this.showStatus('Ninguém no ranking ainda. Seja o primeiro!');
      return;
    }
    const me = board.me;
    board.entries.forEach((e, i) => this.row(e, TOP + i * ROW_H, me !== undefined && sameEntry(e, me)));
    if (me && !board.entries.some((e) => sameEntry(e, me))) {
      // The player is outside the list: their own line goes below a separator.
      const y = TOP + board.entries.length * ROW_H + 10;
      const line = this.add.graphics();
      line.lineStyle(1, COLORS.border, 0.8);
      line.lineBetween(COLS.rank - 10, y - 4, COLS.era + 60, y - 4);
      this.content.add(line);
      this.row(me, y + 2, true);
    }
  }

  private row(e: LeaderboardEntry, y: number, highlight: boolean): void {
    const color = highlight ? COLORS.acidText : COLORS.text;
    if (highlight) {
      this.content.add(this.add.rectangle(COLS.rank - 10, y - 2, COLS.era + 70 - COLS.rank, ROW_H, COLORS.acid, 0.12).setOrigin(0));
    }
    const cell = (x: number, value: string, right = false) => {
      const t = text(this, x, y, value, 14, color, highlight);
      if (right) t.setOrigin(1, 0);
      this.content.add(t);
    };
    cell(COLS.rank, `${e.rank}º`);
    cell(COLS.name, e.displayName.slice(0, 24));
    cell(COLS.time, formatTime(e.elapsedTime), true);
    cell(COLS.dino, DINOSAURS[e.dino]?.name ?? e.dino);
    cell(COLS.difficulty, DIFFICULTY_BY_ID[e.difficulty]?.name ?? e.difficulty);
    cell(COLS.era, e.era > 0 ? `${e.era}` : '—');
  }
}

/** Display names aren't unique: an entry is the player's own when place, name and date all match. */
function sameEntry(a: LeaderboardEntry, b: LeaderboardEntry): boolean {
  return a.rank === b.rank && a.displayName === b.displayName && a.achievedAt === b.achievedAt;
}

function wrap(i: number, n: number): number {
  return (i + n) % n;
}
