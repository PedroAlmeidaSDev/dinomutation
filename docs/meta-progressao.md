# Meta-progressão × dificuldade — DinoMutation

> Branch: `feat/meta-progressao` (inclui `feat/balanceamento` até `897a91c`) · Data: 24/09/2026
> Ferramenta: `tools/balance/sim.ts` — `npm run balance -- --meta nenhum|inicial|medio|max` e `npm run balance:carreira`

## Objetivo

Vencer **sem nenhuma melhoria** deve ser bem difícil. As primeiras vitórias devem exigir tempo de jogo: acumular Fósseis/Maestria e comprar melhorias no Covil.

## O que o simulador passou a modelar

- **Bônus da loja** (atributos por nível) e **passivas de maestria** entram no build (`loadoutFor` em `src/data/meta.ts`, a mesma função que o jogo usa).
- **Jogador médio** (`mixed`): cada escolha de mutação tem 50% de chance de ser a ótima e 50% de ser aleatória. Fica entre o "experiente" (sempre ótima) e o "iniciante" (sempre aleatória).
- **Carreira** (`--carreira`): começa com zero Fósseis e joga até 40 runs com o mesmo dino. Cada run rende as recompensas reais, e o jogador compra sempre o item mais barato já liberado.
- **`--chefe hp,dano`**: substitui `BALANCE.bossScaling` para varrer valores.

## Diagnóstico (antes deste ajuste)

Sem nenhuma melhoria, o jogador experiente vencia 92–99% das runs e o médio 43–81%. Com a loja cheia (versão de 3 níveis), o experiente vencia até 92% das runs **sem nem esquivar**. Ou seja, o jogo já era fácil demais, e a meta-progressão deixaria ainda mais.

## Ajustes

| | Antes | Agora |
|---|---|---|
| Chefe (`BALANCE.bossScaling`) | — | vida ×1,7 · dano ×1,9 (aplicado no spawn; `enemies.ts` intacto) |
| Loja | 3 níveis, custos 60/150/300, maestria 1/3/6 | **5 níveis**, custos 50/120/220/360/520, maestria 1/2/4/6/8 (1.270 🦴 por item, 6.350 por dino) |
| Vida / Dano por nível | +6% / +5% | +12% / +12% |
| Armadura por nível | +4 | +5 |
| Item exclusivo | Raptor: vel. de ataque · Tri: recarga | Raptor: **+8% dano de garra** · Tri: **+8% dano de chifrada** (vel. de ataque esbarrava no limite de retorno decrescente; recarga quase não rendia) |
| Fósseis por run | 8/min, 1 a cada 100 abates, elite 30, chefe 80 | 10/min, 1 a cada 100 abates, elite 30, **chefe 120** (acelerado após playtest: ganho estava lento) |
| XP de maestria | 1 a cada 3 s | 1 a cada 4 s |

## Resultado — perfis fixos (150 runs por dino)

% de vitórias esquivando 60% dos ataques do chefe (entre parênteses: vence até tankando).

| Meta | Experiente (T-Rex / Raptor / Tri) | Médio | Iniciante |
|---|---|---|---|
| **nenhuma** | 28 / 26 / 26 (0) | **2 / 5 / 7** | 0 / 0 / 0 |
| inicial (itens nv 1, M3) | 51 / 47 / 60 | 12 / 14 / 16 | 1 / 1 / 1 |
| média (itens nv 2, M6) | 82 / 61 / 86 | 21 / 18 / 33 | 1 / 3 / 1 |
| máxima (itens nv 5, M10) | 93 / 80 / 95 (até 9 tankando) | 39 / 33 / 63 | 4 / 9 / 13 |

A luta contra o chefe dura ~80–100 s sem melhorias (experiente) e ~50–65 s com a loja cheia.

## Resultado — carreira (desde zero, até 40 runs)

| Jogador | 1ª vitória (run, p25/p50/p75) | Horas até a 1ª (p50) | Vitórias nas runs 1–3 → 26–40 |
|---|---|---|---|
| Experiente | T-Rex 1/2/3 · Raptor 1/3/5 · Tri 1/2/3 | 0,3–0,5 h | 25–52% → 97–100% |
| **Médio** | T-Rex **2/4/7** · Raptor **5/7/11** · Tri **4/5/8** | **0,6–1,2 h** | 4–19% → 63–90% |
| Iniciante | Tri 15/16/21 · Raptor 13/19/28 · T-Rex 19/26/33 | 2,7–4,0 h | 0–1% → 7–34% |

(25 carreiras por dino, economia acelerada.) O jogador médio chega à 1ª vitória com Maestria 3–5 e ~370–850 Fósseis gastos.

## Limitações e trade-offs

- **A escolha de mutações pesa mais que a loja.** Com a mesma dificuldade base, a distância entre experiente e médio é grande. Deixar o jogo base ainda mais difícil atrasaria a 1ª vitória do experiente, mas derrubaria o teto do médio: com chefe ×1,8/×2,1, o médio fica em 25–38% **mesmo com a loja no máximo**. A escolha atual é o meio-termo.
- **As recompensas por derrota estão otimistas**: o simulador conta cada derrota como morte durante o chefe. Quem morre antes ganha menos Fósseis, então as horas reais até a 1ª vitória tendem a ser maiores.
- **Duas passivas do Raptor não aparecem na simulação** (Instinto de Caça = movimento, Reflexo Felino = vida baixa), porque o simulador não modela movimento. O Raptor com meta deve estar um pouco melhor do que os números mostram.
- A morte **antes** do chefe não é modelada (limitação que já existia no simulador). Validar com playtest.
