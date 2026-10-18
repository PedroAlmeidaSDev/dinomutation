/**
 * Paridade da economia: os mesmos casos de shared/economy-cases.json rodam aqui e no
 * servidor (EconomyParityTest). Se uma fórmula mudar só de um lado, um dos testes falha.
 *
 * Uso: npm run test:economy
 */
import cases from '../../../shared/economy-cases.json' with { type: 'json' };
import { DIFFICULTY_BY_ID, type DifficultyId } from '../../src/data/difficulty.ts';
import { fossilsForRun, masteryLevel, masteryXpForRun } from '../../src/data/meta.ts';

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? '  ✔' : '  ✘'} ${msg}`);
  if (!ok) failures++;
};

console.log('\n── Recompensas por run ──');
for (const c of cases.runs) {
  const input = { ...c.input, fossilMult: DIFFICULTY_BY_ID[c.input.difficulty as DifficultyId].fossilMult };
  const fossils = fossilsForRun(input);
  const xp = masteryXpForRun(input);
  check(
    fossils === c.expected.fossils && xp === c.expected.masteryXp,
    `${c.name}: ${fossils} fósseis (esperado ${c.expected.fossils}), ${xp} XP (esperado ${c.expected.masteryXp})`,
  );
}

console.log('\n── Nível de maestria ──');
for (const c of cases.masteryLevels) {
  const level = masteryLevel(c.xp);
  check(level === c.level, `${c.xp} XP → nível ${level} (esperado ${c.level})`);
}

console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
