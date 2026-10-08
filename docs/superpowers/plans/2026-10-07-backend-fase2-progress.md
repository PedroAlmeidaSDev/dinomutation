# SDD ledger — plan: docs/superpowers/plans/2026-10-07-backend-fase2.md

Spec: docs/superpowers/specs/2026-10-05-backend-fase2-design.md (read; binding authority)
Branch: feat/backend-fase2 (working in the main checkout on the feature branch; not main)
Start commit: 9fc0ea4

## Pre-flight scan

| Tasks | Produces → consumes | Finding |
|---|---|---|
| T1 → all | everything under client/ | ok |
| T2 → T3 | shared/economy.json → Maven resource /economy.json | ok |
| T2 → T4 | economy-cases.json {runs[name,input{5 fields},expected], masteryLevels} → Java records | ok, same shape |
| T2 → T14/T15/T16 | package.json scripts: T2 sets test; T14 replaces test + adds test:net; T15 replaces test:net; T16 appends | ok, sequential edits |
| T2 → T16 | vite.config.ts: T16 rewrites whole file and keeps fs.allow | ok |
| T3 → T7 → T9 | IntegrationTest: T7 full rewrite, T9 changes @Import | ok |
| T4 → T6/10/11/12 | Economy API (isUnlocked, shopItem, next, masteryLevel…) | ok |
| T5 → T7 | AccessTokenService.issue(UUID,String) | ok |
| T6 → T10/11/12 | Player.clearedIndex/progress/shopLevel, PlayerRepository.getRequired, SaveDto.of | ok |
| T7 → T8 → T9 | RefreshTokenService create/consume/revokeAll; AuthService.startSession (package-private) | ok |
| T10 → T11 | ProgressRules + FirstClear (player pkg, no player→run dependency) | ok |
| T11/T12 → T15 | RunRewardsDto JSON (unlockedDifficulty = id), PurchaseResponse{save}, error codes | ok |
| T10 → T16 | /players/me/import returns SaveDto; PATCH preferences 204 | ok |
| T13 → T15 | applyRun/applyClear/unlocksBetween/emptySave, SaveStore interface | ok |
| T14 → T15/T16 | api, ApiError.offline, refreshSession 'ok'/'expired'/'offline' | ok |
| T16 → T17 | signIn, importGuestSave, signOut, currentAccount, GOOGLE_CLIENT_ID | ok |
| T13 → T17 | MenuScene edited by both (sequential) | ok |

Per-task self-consistency: T1 ok · T2 ok (parity test is characterization: passes before and after the refactor, Step 12 proves it can fail) · T3 contextLoads has no assertions (smoke test of boot + Testcontainers) · T4–T12 tests match specified code · T13 ok · T14–T16 ok · T17 no automated test (DOM UI; manual roteiro) · T18 README needs the Vercel URL from the owner.

## Rulings (pre-flight)

- Ruling: T3 `contextLoads` with no assertions stays — it is the boot/Flyway/Testcontainers smoke test the spec asks for — cost if wrong: one trivial test to delete.
- Ruling: execution order 1, 2, 13, 14, 15, 16, 17, then 3–12, then 18 — JDK 21 and Docker are missing on this machine (java 17, no docker) and only server tasks need them; client tasks 13–17 use fake fetch and do not depend on the server — cost if wrong: none functional; commits land in a different order than the plan lists.
- Ruling: manual browser checks (T13 step 8, T17 step 5) are not done by subagents; implementers run typecheck/tests/build, and the end-to-end roteiro goes to the owner in the final message (after the server exists, I run an API-level curl smoke instead) — cost if wrong: a UI regression only the owner would see.
- Ruling: T18 README "Jogar" line — ask the owner for the Vercel URL in the final message; until then the line says the game is published on Vercel without a link — cost if wrong: one README line to fill.

## Progress
Task 1: complete (commits 9fc0ea4..39ab8e1, review clean)
Task 2: ⚠️ resolved — Step 4 baseline evidence thin in report; not a gap: expected values were computed from the pre-refactor code by the controller when writing the plan, and Step 12 proved the test detects divergence.
Task 2: minor (deferred): assertSameIds is order-sensitive (join compare) — reordering ids in economy.json throws even if sets match (plan code).
Task 2: minor (deferred): cost array repeated 15× in shared/economy.json (plan-mandated per-dino/item shape).
Task 2: complete (commits 39ab8e1..ed93f75, review clean)
Task 13: (resumed after session interruption at Step 1; same implementer continued from Step 2)
Task 13: Ruling: commit 8bd6dbd carries "Co-Authored-By: Claude Sonnet 5" instead of the constraint's "Claude Opus 5.5" — left as is (unpushed history rewrite for a trailer is not worth the risk); later dispatches restate the exact trailer — cost if wrong: one inconsistent trailer in history.
Task 13: minor (deferred): RunScene storyBossDefeated .then sets state.firstClear with no scene-active guard (harmless: plain object).
Task 13: complete (commits ed93f75..8bd6dbd, review clean)
Task 14: minor (deferred): network ApiError drops the original error (no `cause`) in send()/refreshSession().
Task 14: minor (deferred): no test for retry-after-refresh returning a non-401 error.
Task 14: minor (deferred): onSessionLost holds a single listener (last wins).
Task 14: complete (commits 8bd6dbd..9063aa0, review clean)
Task 15: Ruling: accept implementer's deviation — recordClear mirrors only cleared[dino] locally instead of applyClear (plan code double-counted the bonus into fossils and contradicted the plan's own test); Fósseis stay server-authoritative per spec, refreshed by the next POST /runs — cost if wrong: Covil shows fossils without the first-win bonus until the run ends (only reachable mid-run).
Task 15: ⚠️ resolved — fossils stale by the first-win bonus between recordClear and recordRun; covered by the ruling above (self-heals on POST /runs; hub only reachable after the run ends).
Task 15: (resumed after session interruption before commit; RED evidence not reproducible)
Task 15: minor (deferred): pendingRuns() silently returns [] on corrupt JSON (no log).
Task 15: minor (deferred): DIFFICULTY_BY_ID[unlockedDifficulty] assumes the server sends a known id.
Task 15: complete (commits 9063aa0..2b01db1, review clean)
Task 16: Ruling: plan-mandated gap (session-test lacks ALREADY_IMPORTED and onSessionLost cases) enters the fix loop — both are spec-mandated behaviours and cheap to cover — cost if wrong: a few extra test lines.
Task 16: minor (deferred → fixed in round 1): first session-test case now asserts no fetch call.
Task 16: fix round 1/5 (3 addressed, 0 open — ALREADY_IMPORTED test, onSessionLost test, no-fetch assertion; commits 55f03c3..51ec341)
Task 16: complete (commits 2b01db1..51ec341, review clean)
Task 17: Ruling: plan-mandated Important (a hung request leaves the auth modal stuck: close is blocked while busy and api.ts has no timeout) enters the fix loop — fix at the source: api.ts requests (and refresh) abort after 45 s (covers free-tier cold starts) and surface as ApiError offline/NETWORK, so the modal shows "Servidor indisponível" and unlocks; timeout injectable for tests — cost if wrong: a very slow cold start (>45 s) shows an error and the player retries.
Task 17: minor (deferred): AuthModal root lacks role="dialog"/aria-modal.
Task 17: minor (deferred): tab switch re-runs GIS initialize/renderButton (harmless).
Task 17: fix round 1/5 (1 addressed, 0 open — 45 s request timeout in api.ts; commits e025b78..6406bc3)
Task 17: minor (deferred): worst case ~3×45 s for a 401 + refresh + retry against a dead server.
Task 17: complete (commits 51ec341..6406bc3, review clean; manual browser E2E deferred to owner)
BLOCKED before Task 3: JDK 21 and Docker not installed (java 17, no docker) — asked the owner (install via winget or by themselves).
UNBLOCKED: JDK 21.0.12 and Docker 29.8.2 available (owner installed WSL + rebooted). Resuming at Task 3.
Owner gave Vercel URL: https://dinomutation.vercel.app/ — use it in the T18 README 'Jogar' line (supersedes the pre-flight README ruling).
Task 3: minor (deferred): TestcontainersConfiguration uses raw PostgreSQLContainer type (plan code; unchecked warning).
Task 3: complete (commits 6406bc3..b101c13, review clean)
Task 4: implemented (commits b101c13..a89882d; 23 tests, verify BUILD SUCCESS) — TASK REVIEW PENDING (owner had to leave; branch pushed for handoff). Next session: generate review package b101c13..a89882d, run the Task 4 review, then continue at Task 5.
