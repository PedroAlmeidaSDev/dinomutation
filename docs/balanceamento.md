# Relatório de Balanceamento — DinoMutation

> Branch: `feat/balanceamento` · Data: 24/09/2026
> Ferramenta: `tools/balance/sim.ts` (`npm run balance` = jogo atual · `npm run balance:antes` = valores antigos)
>
> **Status:** ✅ Etapa 1 (§4) **aplicada** no código. As §3.x descrevem o estado *anterior* à Etapa 1.

## 1. Resumo

A sensação de "jogo fácil" se confirma nos números. Com escolhas de upgrade razoáveis:

| | T-Rex | Velociraptor | Triceratops |
|---|---|---|---|
| Tempo para matar o **Giganotosaurus** (mediana) | **14 s** | **16 s** | **17 s** |
| Tempo para matar o **Carnotaurus Alfa** | 11 s | 12 s | 15 s |
| Runs em que dá para vencer o chefe **sem esquivar nada** | 98% | 100% | 100% |
| Mordidas do chefe para morrer | 17 | 14 | 39 |
| Cura/s aos 7:00 (quase toda de Voracidade) | 25 | 35 | 33 |

As causas principais:

1. **O poder do jogador cresce ~30×, os inimigos ~3×.** O DPS contra alvo único vai de ~30 para ~800–940 em 9 minutos, enquanto a vida dos inimigos só cresce de forma linear (+24%/min → ×3,2 aos 9:00) e o dano deles cresce +7%/min (×1,6).
2. **Chefe e elite não escalam.** O Giganotosaurus tem 9.500 HP fixos e dá cerca de **12–15 de dano/s** mesmo se todos os ataques acertarem. Com 50% de redução de dano, isso vira ~6,6/s, e a cura passiva do jogador (~10/s) cobre tudo.
3. **A cura escala com o número de abates, e a horda serve de comida.** Voracidade (1 HP por abate × nível) com 12–25 abates/s rende 25–35 HP/s. A Hemofagia dispara também nos ticks de sangramento (ver §3.4), ou seja, cura 6 HP/s por nível de forma praticamente constante.
4. **A horda nunca se acumula.** Com uma build razoável, a capacidade de matar é igual à taxa de spawn: sobram de 8 a 22 inimigos vivos aos 9:00, sendo que o limite (`maxAlive`) é 175. O limitador é o diretor, não o jogador.
5. **Velocidade de ataque é o arquétipo dominante.** A tag `speed` vira a principal em 55–75% das runs. Reflexos (+60%), Frenesi (+90%) e Predador Frenético (+120%) somam na mesma pilha sem retorno decrescente, e cada golpe extra também aplica sangramento e veneno.
6. **Com o Triceratops, a redução de dano chega ao teto (70%) já aos 7:00.**

Os ajustes propostos na §4, validados no mesmo simulador, levam o chefe a **~50–60 s de luta, exigindo esquiva**: só 12–25% das runs bem jogadas vencem apenas tankando. Uma build mal montada passa a perder na maioria das vezes.

---

## 2. Metodologia (como os testes foram feitos)

O Phaser não roda em modo headless neste projeto, então os testes foram feitos com um **simulador numérico** (`tools/balance/sim.ts`) que:

- importa os **dados reais** do jogo (`src/data/balance.ts`, `director.ts`, `enemies.ts`, `dinosaurs.ts`, `upgrades.ts`). Mudar um número no jogo muda o resultado da simulação;
- replica a **mesma lógica de sorteio de upgrades** do `UpgradeSystem` (pesos por raridade e nível, afinidade de tags, requisitos, Evolução Apex, mutagênico da elite);
- replica as fórmulas de dano (`DamageSystem`): bônus aditivo, crítico, armadura `100/(100+A)`, pilhas de sangramento e veneno, invocações, habilidades, Cauda Clava, Espinhos, Execução etc.;
- simula a linha do tempo do diretor segundo a segundo (fases, eventos, elite às 6:00, chefe às 9:00), a economia de DNA/XP e os level-ups;
- roda **400 runs por dinossauro** em dois estilos de jogador:
  - **inteligente**: em cada level-up, escolhe a carta que mais melhora uma nota combinada (DPS no chefe, capacidade de limpar a horda, vida efetiva e cura);
  - **aleatório**: escolhe qualquer uma das 3 cartas. Serve de piso: um jogador real fica entre os dois.

**Premissas** (ajustáveis em `ASSUME` no topo do arquivo): 80% do tempo batendo na horda, 70% no chefe, 95% do DNA coletado, 60% dos ataques do chefe esquivados no cenário "esquivando".

**Limitações:** não há movimento real, pathing nem colisão; a densidade de inimigos em volta do jogador é estimada a partir do número de vivos. Os números servem para **comparar configurações**, não para prever uma run específica. Recomendação: validar os valores finais com playtest e com a telemetria de debug sugerida na §7.

---

## 3. Diagnóstico detalhado (estado atual)

### 3.1 Curva de poder × curva de ameaça

Jogador "inteligente", mediana de 400 runs:

| Tempo | Nível | DPS no chefe (T-Rex / Raptor / Tri) | HP dos inimigos | Tempo para matar Carnotaurus (T-Rex) |
|---|---|---|---|---|
| 1:00 | 6–7 | 59 / 68 / 51 | ×1,24 | 5,9 s |
| 4:00 | 18–20 | 198 / 203 / 157 | ×1,96 | 4,3 s |
| 7:00 | 32–33 | 508 / 464 / 419 | ×2,68 | 2,4 s |
| 8:59 | 43–44 | 938 / 836 / 794 | ×3,16 | 1,4 s |

- O jogo **fica mais fácil com o tempo**: o tempo para matar cada inimigo cai continuamente. Um Compy morre em 0,09–0,27 s no fim.
- O jogador chega ao **nível ~44** e tem **~22 upgrades distintos**. A curva de XP (`base 4, perLevel 3, exp 1.38`) é generosa: nível 6–7 já no 1º minuto.

### 3.2 Chefe (Giganotosaurus)

| Métrica | Valor atual | Problema |
|---|---|---|
| HP / armadura | 9.500 / 30 | Não escala; o jogador faz ~800–940 DPS |
| Dano/s bruto (100% de acertos) | 11,9 (fase 1) / 15,3 (fase 2) | Menor que a cura de uma build média no fim |
| Mordida | 38 | 14 a 39 mordidas para matar o jogador |
| Resistência a controle | 75% | Ok |
| Lacaios (8 Compys + 2 Raptors) | dão XP e alimentam efeitos de abate | O jogador **se cura** matando os lacaios do chefe |
| Fase 2 | +30% de velocidade, wind-up −22%, cooldown −35% | Não chega a aparecer, o chefe morre antes |
| Pisão | só o 1º círculo que acerta causa dano | Ok, mas pouco ameaçador |

**Resultado:** vitória garantida em 98–100% das runs bem jogadas, **sem precisar esquivar**. Mesmo escolhendo cartas aleatoriamente, 56% (T-Rex) a 100% (Tri) das runs vencem.

### 3.3 Elite (Carnotaurus Alfa)

1.800 HP e armadura 15, sem escala. Morre em **11–15 s** mesmo com o jogador dividindo atenção com a horda. Como recompensa (mutagênico raro) ela é ótima, mas não oferece desafio.

### 3.4 Sustento (cura) e iFrames

- **iFrames de 0,35 s** após qualquer golpe limitam o dano de contato a ~2,9 golpes/s. Com Compys (4 de dano) e 50% de redução, cercado o jogador toma no máximo ~19–26 HP/s.
- A cura aos 7:00 (25–35 HP/s) **supera esse máximo**: o jogador pode ficar parado no meio da horda.
- **Bug/efeito colateral da Hemofagia:** `DamageSystem.hitEnemy` emite `onHit` também para ticks de DoT, e `healOnStatusHit` aceita esses ticks. Na prática ela cura 1,2 × nível **5 vezes por segundo** (18 HP/s no nível 3, 27 HP/s com Apex) sempre que houver um inimigo sangrando.
- **Voracidade** não tem teto: 1 HP × nível por abate.
- **Carne** (0,6% por abate, cura 30%) dá ~1% de vida/s no fim da run.

### 3.5 Diretor (spawns)

- Taxa de spawn no auge (7:30–9:00): ~12 inimigos/s. A build média mata tudo que nasce, então `maxAlive` 140/175 **nunca é atingido**.
- **Respiro de 5:30 a 6:15** (fase `330`: intervalo 1,0 e `maxAlive` 80) justamente antes da elite.
- Quando o chefe nasce, **os eventos param** e a fase `540` é a mais calma do jogo (intervalo 1,4 e `maxAlive` 45).

### 3.6 Builds

- A tag principal é `speed` em 55–75% das runs, porque todos os bônus de velocidade de ataque somam sem teto.
- Cartas mais escolhidas pelo jogador "inteligente": Frenesi, Predador Frenético, Reflexos Rápidos, Cauda Clava, Gigantismo, Voracidade, Dentes/Garras Serrilhadas.
- **T-Rex com cartas ruins** é o único caso realmente difícil: a mordida acerta 1 alvo e ele não consegue limpar a horda (capacidade de ~0,7 abate/s, com a horda chegando a 199 inimigos vivos). Isso pede um ajuste de design, não só de números.
- O **Triceratops** chega aos 70% de redução (o teto) e 1.476 de vida efetiva. É o dinossauro mais fácil.

---

## 4. Plano para aumentar a dificuldade

As mudanças estão divididas em etapas independentes, cada uma pode ir em um PR separado.

### Etapa 1 — Números (baixo risco, só dados + 3 regras pequenas) · ✅ aplicada

| Área | Hoje | Proposta | Arquivo |
|---|---|---|---|
| Curva de XP (`exponent`) | 1,38 | **1,44** | `data/balance.ts` |
| HP dos inimigos | `1 + 0,24·m` | **`1 + 0,26·m + 0,02·m²`** (×4,0 aos 9:00) | `balance.ts` + `RunDirector.scaling()` |
| Dano dos inimigos | +7%/min | **+11%/min** | `balance.ts` |
| iFrames | 0,35 s | **0,28 s** | `balance.ts` |
| Redução de dano máxima | 70% | **60%** | `balance.ts` |
| Vel. de ataque (retorno decrescente) | sem teto | **bônus acima de +100% rende 50%** | `StatsComponent.get()` (caso especial para `attackSpeed`) |
| Voracidade | 1 HP/abate × nível | **0,5 HP/abate, máx. 2 HP/s por nível** | `upgrades.ts` + `healFlat` com ICD |
| Hemofagia | dispara em ticks de DoT, 1,2 | **só em golpes diretos (`!hit.isDot`), 0,8** | `UpgradeEffects.healOnStatusHit` |
| Lacaios do chefe | dão XP e contam como abate | **flag `noRewards`**: sem DNA, sem `onKill` de cura | `SpawnSystem.spawnAround`, `Run.handleKill` |
| Fase 5:30 | intervalo 1,0 · máx. 80 | **intervalo 0,7 · lote 3–5 · máx. 120** | `data/director.ts` |
| Fase do chefe | intervalo 1,4 · máx. 45 | **intervalo 0,9 · lote 3–4 · máx. 90** | `data/director.ts` |
| Carnotaurus Alfa | 1.800 HP · arm. 15 | **4.200 HP · arm. 20 · dano +25%** | `data/enemies.ts` |
| Giganotosaurus | 9.500 HP · arm. 30 | **24.000 HP · arm. 35** | `data/enemies.ts` |
| Dano do chefe | mordida 38 · investida 40 · pisão 30 · rugido 16 · cooldown 1,25 | **52 · 56 · 42 · 24 · cooldown 1,0** | `data/enemies.ts` |
| Ataques pesados do chefe | armadura normal | **ignoram 35% da redução do jogador** | `attacks.ts` (`resolveCone/Circle` com `pierce`) |
| Fúria por tempo | — | **após 150 s de luta: dano ×1,5** | `Giganotosaurus.ts` |
| Mordida do T-Rex | 1 alvo | **2 alvos** | `data/dinosaurs.ts` |

Detalhes de implementação:
- Retorno decrescente: `StatsComponent` aceita `softCaps` por stat (`BALANCE.player.softCaps`); hoje só `attackSpeed`.
- Voracidade: `healFlat` ganhou o parâmetro opcional `maxPerSec` (janela de 1 s).
- Lacaios: `Enemy.noRewards`, definido por `SpawnSystem.spawnAround` (padrão `true`). Sem DNA/drops em `Run.handleKill`, e `UpgradeSystem` ignora gatilhos `onKill` deles. A contagem de abates continua.
- Perfuração: `PlayerHitRequest.pierce`, lida de `params.pierce` do inimigo em `resolveCone/resolveCircle` (só o Giganotosaurus tem).
- Fúria: `params.enrageTime/enrageDamage/enrageWindup` no Giganotosaurus; `Enemy.damageMult` deixou de ser `readonly`.

**Resultado simulado da Etapa 1** (400 runs, jogador inteligente → aleatório):

| | T-Rex | Raptor | Tri |
|---|---|---|---|
| Duração da luta com o chefe (mediana) | 14 → **47 s** | 16 → **56 s** | 17 → **58 s** |
| Vence **sem esquivar** | 98 → **19%** | 100 → **12%** | 100 → **25%** |
| Vence **esquivando** (total) | 100 → **92%** | 100 → **91%** | 100 → **99%** |
| Tempo para matar a elite | 11 → 28 s | 12 → 31 s | 15 → 38 s |
| Nível aos 9:00 | 43 → 41 | 44 → 41 | 44 → 41 |
| Cura/s aos 9:00 | 27 → 7 | 28 → 8 | 28 → 6 |
| Build aleatória perde | 44 → 96% | 10 → 95% | 0 → 87% |

> ⚠️ **Risco:** com a proposta, a build aleatória perde quase sempre. Num roguelite isso é aceitável (as escolhas passam a importar), mas convém ter um **modo Casual** (Etapa 2) com o chefe a ~16.000 HP e dano do chefe −20% para jogadores novos.

### Etapa 2 — Níveis de ameaça (dificuldade selecionável)

Um seletor na tela de escolha do dinossauro, liberado progressivamente:

| Nível | Liberação | Modificadores |
|---|---|---|
| **Casual** | sempre | Valores da Etapa 1 com chefe/elite −30% de HP e dano do chefe −20% |
| **Normal** | sempre | Etapa 1 |
| **Difícil** | vencer o Normal | Inimigos +25% HP, +15% velocidade, elite surge com 2 Carnotaurus de escolta, chefe com 3 fases |
| **Pesadelo** | vencer o Difícil | +50% HP, +25% dano, carne não cai, rerolls 0, e **mutações de ameaça** aleatórias (ver Etapa 4) |

Implementação:

- `data/difficulty.ts` com `DIFFICULTIES: Record<DifficultyId, { hpMult, dmgMult, speedMult, bossHpMult, rerolls, meatChance, ... }>`.
- `Run` recebe `difficulty` no construtor (como já recebe `dinoId`). `RunDirector.scaling()` e `SpawnSystem.spawn()` multiplicam os valores. **Hoje elite e chefe recebem `{ hpMult: 1 }` fixo**, e devem passar a usar `bossHpMult`.
- `Save.ts`: novo campo `cleared: Partial<Record<DinoId, DifficultyId>>`. É compatível com saves antigos porque o `loadSave` já faz merge com `EMPTY`.
- HUD: ícone do nível de ameaça no canto.

### Etapa 3 — Inimigos com mais variedade de ameaça

- **Variantes "Campeão"** (a partir das 4:00, ~3% dos spawns): o mesmo inimigo com ×5 de HP, aura, +20% de tamanho, 5× de XP e um afixo: *Veloz*, *Blindado* (+30 de armadura), *Venenoso* (deixa poça ao morrer), *Vampírico* (cura aliados próximos). Aumenta a ameaça sem estourar o limite de 230 inimigos.
- **Dilophosaurus**: projéteis em leque de 3 depois das 6:00.
- **Pterossauro**: mergulho telegrafado (hoje só atira).
- **Pachy**: investida em grupo (os eventos de estouro já existem; basta fazê-los investir em sincronia).
- **Mini-chefe às 3:00** (ex.: *Pachy Alfa* ou *Utahraptor*). Quebra o início, que hoje é o trecho mais fácil, e dá um 2º mutagênico raro.

---

## 5. Chefes mais desafiadores

O objetivo é que a luta passe a exigir **leitura de padrões e posicionamento**, e não só vencer uma corrida de números.

### 5.1 Giganotosaurus: redesign em 3 fases

| Fase | HP | Novidades |
|---|---|---|
| **1 — Caçador** (100–66%) | — | Kit atual com os números da Etapa 1. **Mordida em combo**: 2 mordidas seguidas com re-mira (wind-up 0,45 s cada), que punem quem fica colado |
| **2 — Fúria** (66–33%) | rugido de transição | **Investida tripla** com re-mira entre as investidas; **varrida de cauda** 360° (raio 200, wind-up 0,5 s) se o jogador ficar atrás dele por >1 s (contra ficar circulando); o rugido passa a aplicar **Lento 40% por 2 s** no jogador, preparando o combo seguinte |
| **3 — Predador Supremo** (<33%) | aura vermelha, arena "encolhe" (anel de rochas caindo telegrafado nas bordas) | **Terremoto**: 6–10 círculos telegrafados caindo por 4 s; **invoca 1 Carnotaurus** (sem recompensa) em vez de Compys; pisões em **ondas de choque que se expandem** (anéis que precisam ser atravessados no tempo certo, via dash, em vez de apenas evitados) |

Mecânicas de suporte:

- **Janela de punição (recompensa habilidade):** se a investida do chefe acertar uma rocha ou parede, ele fica **atordoado 2 s e recebe +50% de dano** (o `onBlocked` já existe, só falta o estado de "atordoado + vulnerável"). Isso transforma o cenário em ferramenta tática.
- **Fúria por tempo** aos 150 s (dano ×1,5, wind-up −20%): impede vencer por atrito.
- **Resistência a controle:** 75% → 90% e imune durante investida/combo.
- **Ataques pesados perfuram 35% da redução** (§4, Etapa 1).
- **Barra de vida segmentada** no HUD (marcas em 66% e 33%) e banner a cada fase.

Implementação: `Giganotosaurus.ts` já é uma máquina de estados (`walk / windup / charging / recover / rage`). Basta acrescentar `phase: 1|2|3`, os ataques `comboBite`, `tailSweep`, `quake` e `tripleCharge`, e o estado `stunnedVulnerable`. Os telegraphs necessários (`cone`, `line`, `circle`) já existem em `Telegraphs.ts`. Para a onda de choque em expansão, criar `Telegraphs.ring(x, y, rMin→rMax, dur)`.

### 5.2 Carnotaurus Alfa

- 4.200 HP (Etapa 1) e **escolta de 2 Carnotaurus** a partir do Difícil.
- **Frenesi a 50%**: o ciclo slam → investida → choque vira slam → investida → investida → choque, com cooldown −30%.
- **Investida guiada**: corrige a direção em até 25° durante a primeira metade.
- Se não for morta em 60 s, **foge** e o mutagênico é perdido. Isso cria pressão real para priorizar a elite.

### 5.3 Novos chefes (para o modo infinito e rotação)

| Chefe | Papel | Padrões principais |
|---|---|---|
| **Spinosaurus** | chefe de "zona" | cria poças de água que causam lentidão; salto na água com emersão telegrafada; golpe de garra em cruz |
| **Ankylosaurus Ancião** | tanque / teste de dano | armadura 80 que só cai ao acertar a **cauda** por trás; clava que rebate projéteis; rolamento |
| **Quetzalcoatlus** | aéreo | voa fora de alcance (só pode ser atingido quando pousa após o mergulho); chuva de projéteis |
| **Matriarca Raptor** | enxame inteligente | 3 raptors-alfa coordenados (flanqueiam, um distrai e os outros atacam); dividem a vida |

---

## 6. Modo infinito ("Era Sem Fim")

### 6.1 Fluxo

1. O Giganotosaurus morre → a vitória é registrada (`run.victory = true`, `recordRun` como hoje).
2. Em vez de ir direto para a `VictoryScene`, abre um overlay: **"VITÓRIA! Continuar na Era Sem Fim?"** com os botões **[Continuar]** e **[Encerrar]**.
3. Se continuar: o `outcome` volta a `null`, o diretor entra em `mode = 'endless'`, vem uma **carta lendária garantida** e 10 s de calma.
4. A run termina quando o jogador morre. A tela final mostra "Vitória + Era N alcançada".

Mudanças no código:

- `Run.handleKill`: hoje o chefe define `this.outcome = 'victory'`. Passaria a emitir `bus.emit('bossDefeated')` e definir `run.victory = true`; o `outcome` fica a cargo da cena, conforme a escolha do jogador.
- `RunScene`: overlay de escolha (reaproveitar o `PauseMenu`/`UpgradeSelection` para o layout).
- `RunDirector`: separar a timeline atual em `StoryTimeline` e criar `EndlessTimeline`.

### 6.2 Estrutura das Eras (ciclos de ~3 min)

Cada **Era** dura 180 s:

| Tempo na Era | Conteúdo |
|---|---|
| 0:00–1:30 | Horda com pool aleatório entre os 6 inimigos + campeões (§4, Etapa 3) |
| 1:30 | Evento (enxame, anel ou estouro, sorteados) |
| 2:00 | **Elite** (Carnotaurus Alfa, depois duplas de elites) |
| 2:30 | Pico da horda |
| 3:00 | **Chefe da Era**, em rotação: Giganotosaurus → Spinosaurus → Ankylosaurus → Quetzalcoatlus → Matriarca → repete com +1 fase |

**Escala por Era** (multiplicativa, sobre o valor do fim da história):

- HP ×1,35 por Era, dano ×1,15 por Era, velocidade +3% por Era (teto de +30%)
- `maxAlive` sobe até o teto de 230; depois disso a pressão vem **só de campeões** (proporção +3% por Era) para proteger a performance
- A partir da **Era 3**, 1 **Mutação de Era** aleatória acumulativa, anunciada em banner:
  - *Chuva de Meteoros*: círculos aleatórios caindo na arena
  - *Noite*: raio de visão reduzido (vinheta)
  - *Carniceiros*: quando um inimigo morre, os inimigos próximos recuperam 5% da vida
  - *Pele Grossa*: todos os inimigos com +20 de armadura
  - *Frenesi Selvagem*: inimigos +25% de velocidade abaixo de 50% de HP
  - *Seca*: sem drops de carne

**Meta:** um jogador com build forte morre, em mediana, entre a **Era 4 e a Era 6** (~12–18 min depois da vitória). Dá para calibrar com uma extensão do simulador (`--infinito`), que usaria a mesma estrutura de diretor.

### 6.3 Progressão do jogador no infinito

- Os level-ups continuam. Quando o pool acabar (tudo no nível máximo), entram as **Evoluções Infinitas**: cartas repetíveis com retorno decrescente (+4% de dano, +3% de vel. de ataque, +10 HP, +2 de armadura), no lugar de Carne Fresca/Ovo Vital.
- A cada chefe de Era: **escolha lendária** (os lendários restantes; se não houver, "Evolução Suprema": +1 nível máximo em um upgrade à escolha).
- O custo de XP continua crescendo (`exponent` 1,44), então os níveis ficam naturalmente mais raros.

### 6.4 Pontuação e save

- `SaveData` ganha: `bestEra: Partial<Record<DinoId, number>>`, `bestEndlessTime`, `endlessRuns`.
- `ResultScene`: novas linhas "ERA ALCANÇADA" e "TEMPO NA ERA SEM FIM"; recorde por dinossauro no menu.
- (Opcional) **Seed do dia**: mesmas mutações e rotação de chefes para todos, com ranking local.

---

## 7. Ordem de implementação sugerida

| # | Entrega | Esforço | Depende de |
|---|---|---|---|
| 1 | ✅ **Etapa 1**: números + Hemofagia só em golpe direto + teto da Voracidade + `noRewards` nos lacaios + teto de vel. de ataque | S | — |
| 2 | Telemetria de debug: log por minuto (nível, DPS real, dano recebido, cura, vivos) em `?debug`, para calibrar o simulador com playtests | S | — |
| 3 | Giganotosaurus em 3 fases + janela de punição + fúria + perfuração | M | 1 |
| 4 | Carnotaurus Alfa (frenesi, investida guiada, fuga) | S | 1 |
| 5 | Níveis de ameaça (Casual/Normal/Difícil/Pesadelo) + save | M | 1 |
| 6 | Inimigos campeões + mini-chefe das 3:00 | M | 1 |
| 7 | Modo infinito: fluxo pós-vitória, `EndlessTimeline`, Eras, Evoluções Infinitas, save/placar | L | 3, 6 |
| 8 | Novos chefes (Spinosaurus → Ankylosaurus → Quetzalcoatlus → Matriarca) | L cada | 7 |
| 9 | Mutações de Era | M | 7 |

### Metas para considerar o balanceamento pronto

| Métrica | Hoje | Meta |
|---|---|---|
| Luta com o chefe (build boa) | 14–17 s | **45–90 s** |
| Vitória só tankando | 98–100% | **< 25%** |
| Vitória jogando bem (esquivando) | 100% | **80–95%** |
| Cura/s ÷ dano máximo de contato aos 8:00 | > 1,0 | **< 0,4** |
| Abates ÷ spawns aos 7–9 min | 1,0 (horda some) | **0,8–1,0** (horda presente) |
| Nível aos 9:00 | ~44 | **36–40** |
| Elite | 11–15 s | **25–40 s** |
| Era média de morte no infinito | — | **4–6** |

---

## 8. Como reproduzir

```bash
npm run balance                      # jogo atual (com a Etapa 1), 300 runs por dino/estilo
npm run balance -- 1000              # mais runs
npm run balance:antes                # valores anteriores à Etapa 1, para comparar
npm run balance -- 400 --json out.json   # exporta a timeline completa em JSON
```

Para testar um valor novo, mude o dado em `src/data/*` e rode de novo. As premissas de habilidade do jogador ficam em `ASSUME`. As regras de mecânica (`RULES`) são lidas dos dados do jogo, e `applyOriginal()` guarda os valores antigos.
