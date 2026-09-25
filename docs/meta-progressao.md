# Meta-progressão × dificuldade — DinoMutation

> Versão 0.2.0 · Branch: `feat/dificuldades` · Data: 25/09/2026
> Ferramenta: `tools/balance/sim.ts` — `npm run balance -- --meta nenhum|inicial|medio|max --dificuldade filhote|normal|predador|extincao` e `npm run balance:carreira`

## Objetivo

- **Prender o jogador novo:** a 1ª vitória precisa vir cedo (Filhote) e as primeiras compras no Covil precisam dar sensação de evolução logo nas primeiras runs.
- **Não ficar fácil demais:** o Normal continua sendo o desafio de referência, e Predador e Extinção são o teto para quem já tem tudo.

## Sistema

### Fósseis e loja (Covil)
- Fósseis por run: **15/min**, 1 a cada **60** abates, elite **40**, chefe 120, multiplicados pela dificuldade (`fossilMult`).
- 5 itens por dino (4 compartilhados + 1 exclusivo), 5 níveis cada. Custos **30 / 70 / 150 / 300 / 480** (1.030 por item, 5.150 por dino).
- **A Maestria não trava a loja.** O preço é o único limite.

### Maestria (`MASTERY_TRACK` em `src/data/meta.ts`)
A Maestria evolui o próprio dino. As passivas usam o `power` do motor de upgrades: rank I = ×1, rank II = ×1,5 (o Alfa da Matilha usa ×2, porque o número de fantasmas é inteiro). A habilidade ganha **+15% de dano** (`dmg_roar` / `dmg_pounce` / `dmg_charge`) e **5% de redução de recarga** por nível.

| Maestria | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|
| Libera | Passiva 1 | Habilidade I | Passiva 2 | Passiva 1 → II | Habilidade II | Passiva 3 | Passiva 2 → II | Habilidade III | Passiva 3 → II |

### Dificuldades (`src/data/difficulty.ts`)
Os multiplicadores entram em `RunDirector.scaling()` por cima do escalonamento normal e também valem na Era Sem Fim. O Normal é o jogo de referência (×1).

| | Inimigos e elite (vida / dano) | Chefe (vida / dano) | Fósseis | Bônus da 1ª vitória | Liberação |
|---|---|---|---|---|---|
| **Filhote** | ×0,75 / ×0,7 | ×0,6 / ×0,55 | ×0,75 | 60 | desde o início |
| **Normal** | ×1 | ×1 | ×1 | 150 | vencer Filhote |
| **Predador** | ×1,3 / ×1,25 | ×1,45 / ×1,35 | ×1,4 | 250 | vencer Normal |
| **Extinção** | ×1,5 / ×1,45 | ×1,8 / ×1,6 | ×1,8 | 400 | vencer Predador |

- O progresso é **por dino** (`SaveData.cleared`). A última dificuldade escolhida fica salva por dino (`SaveData.difficulty`).
- **Saves antigos:** quem já tinha alguma vitória recebe o Filhote como vencido em todos os dinos, ou seja, o Normal já vem liberado.

## Resultado — perfis fixos (200 runs por dino)

% de vitórias esquivando 60% dos ataques do chefe. Ordem: T-Rex / Raptor / Tri.

| Cenário | Experiente | Médio | Iniciante |
|---|---|---|---|
| Filhote, sem melhorias (1ª run de um jogador novo) | 100 / 99 / 100 | 89 / 84 / 78 | 29 / 32 / 25 |
| Normal, sem melhorias | 38 / 44 / 20 | 5 / 11 / 2 | 1 / 1 / 0 |
| Extinção, tudo no máximo (loja 5/5, M10) | 45 / 33 / 13 | 8 / 9 / 2 | — |

## Resultado — carreira (40 carreiras × 40 runs, do zero, sempre na maior dificuldade liberada)

Run da 1ª vitória em cada dificuldade (mediana; entre parênteses, horas de jogo até lá).

| Jogador | Filhote | Normal | Predador | Extinção |
|---|---|---|---|---|
| Experiente | 1 (0,2 h) | 2 (0,3 h) | 4–7 (0,7–1,2 h) | 7–15 (1,2–2,5 h) |
| Médio | 1 (0,2 h) | 3–5 (0,5–0,8 h) | 10–16 (1,6–2,7 h) | 19–20 (3,1 h); Tri: 73% nunca chega |
| Iniciante | 2 (0,3–0,4 h) | 11–12 (1,8–2,1 h) | 25–40 (3,7–5 h); 7–75% nunca chega | quase nunca |

- **Antes desta versão**, o iniciante levava 10–26 runs até a primeira vitória, e sem nenhum degrau intermediário. Agora ele vence na 2ª run e chega ao Normal em ~11.
- Com o jogador sempre subindo de dificuldade, a taxa de vitórias se estabiliza em ~30–45% (experiente) e ~10–25% (médio). O jogo continua desafiador.
- Em 40 runs, todos os perfis completam a loja (5.150 Fósseis) e chegam a M10.

## Limitações e trade-offs

- **O Triceratops fica atrás em todas as dificuldades** (desde o rebalanceamento da 0.1.1/0.1.2). Na Extinção com tudo no máximo, ele vence 13% contra 45% do T-Rex. Próximo ajuste recomendado.
- **As recompensas por derrota estão otimistas:** o simulador conta cada derrota como morte durante o chefe. Quem morre antes ganha menos Fósseis, então as horas reais tendem a ser maiores.
- A morte **antes** do chefe não é modelada, e duas passivas do Raptor (Instinto de Caça e Reflexo Felino) ficam de fora, porque o simulador não modela movimento. Validar com playtest, principalmente o Filhote.
