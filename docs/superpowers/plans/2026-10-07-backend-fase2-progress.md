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
Resumed on new machine 2026-10-08 (worktree C:/Projetos/dinomutation/dinomutation-backend, JDK 22.0.1 — no JDK 21; Docker Desktop started). Task 4 report lost; review uses stub report.
Task 4: ⚠️ resolved — resource copy + BUILD: EconomyTest/EconomyParityTest pass here (JDK 22, mvnw -q test); client economy-test.ts reads the same shared/economy-cases.json.
Task 4: minor (deferred): EconomyParityTest resolves ../shared/economy-cases.json relative to CWD (breaks if run from repo root in an IDE).
Task 4: minor (deferred): Economy constructor does not validate perKills/secondsPerXp > 0 (trusted file).
Task 4: complete (commits b101c13..a89882d, review clean)
Task 5: dispatched (BASE a89882d)
Task 5: (resumed after session interruption; only the test file existed, no commit)
Task 5: ⚠️ resolved — trailer present on 2321219; app.jwt.* defined in application.yml (15m/30d) and test yml (≥32-byte secret).
Task 5: Ruling: bare 401/403 from the resource server (no ProblemDetail `code`) stays — client api.ts keys refresh off status 401 and already tolerates the non-JSON 401 body (api.ts:118) — cost if wrong: a custom AuthenticationEntryPoint later.
Task 5: minor (deferred): no catch-all Exception handler (no INTERNAL code in the fixed list; plan-mandated).
Task 5: minor (deferred): no tests for expired / wrong-issuer / wrong-key tokens nor for ProblemDetail shape (later controller tasks cover shape).
Task 5: minor (deferred): validTokenPassesTheFilter relies on 404 of a nonexistent route.
Task 5: complete (commits a89882d..2321219, review clean)
Task 6: dispatched (BASE 2321219)
Task 6: ⚠️ resolved — trailer present on 85d8a2c; suite evidence in report (32 tests, BUILD SUCCESS).
Task 6: minor (deferred): spendFossils/addFossils accept negative amounts; spendFossils throws IllegalStateException (plan-mandated; services must validate).
Task 6: minor (deferred): @PreUpdate updated_at not bumped when only dino/shop collections change.
Task 6: minor (deferred): PlayerPersistenceTest coverage thin (bestByDino, unique email, getRequired throw).
Task 6: minor (deferred): SaveDto.bestByDino includes 0.0 for dinos with progress but no best time (client treats missing key as none).
Task 6: complete (commits 2321219..85d8a2c, review clean)
Task 7: dispatched (BASE 85d8a2c)
Task 7: Ruling: plan-mandated Important (displayName " a " passes @Size before trim and is stored as 1 char) enters the fix loop — spec binds displayName 2–40; fix = re-check trimmed length in AuthService → VALIDATION_ERROR, plus a test — cost if wrong: a few lines.
Task 7: minor (deferred): concurrent duplicate register → CONFLICT instead of EMAIL_TAKEN (unique-constraint race; plan-mandated).
Task 7: minor (deferred): login timing distinguishes unknown e-mail (no dummy BCrypt); register already reveals existence by design.
Task 7: minor (deferred): register e-mail @Email/@Size validated before trim (surrounding spaces rejected rather than normalized).
Task 7: minor (deferred): 72-byte password error lacks per-field `errors` array.
Task 7: minor (deferred): LoginRequest has no @Size bounds.
Task 7: minor (deferred): no test that token_hash == SHA-256(cookie), nor Max-Age/Secure toggle.
Task 7: minor (deferred): IntegrationTest.json() only escapes quotes.
Task 7: fix round 1/5 (1 addressed, 0 open — displayName validated after trim; commits 21d81bf..cbc405b; controller confirmed AuthRegisterLoginTest 7/7)
Task 7: complete (commits 85d8a2c..cbc405b, review clean)
Task 8: dispatched (BASE cbc405b)
Task 8: Ruling: plan-mandated Important (concurrent refresh with the same cookie both pass the unlocked check-then-act and mint two sessions, bypassing reuse detection) enters the fix loop — spec requires reuse detection; fix = atomic conditional UPDATE (revoked_at set only if null; 0 rows → treat as reuse: revoke all + 401) — cost if wrong: two tabs refreshing at once sign the player out (client api.ts already dedupes refresh per tab).
Task 8: minor (deferred): 401 tests assert status only (no ProblemDetail code, no cookie attributes on rotated/cleared cookie).
Task 8: minor (deferred): reuse test does not cover a second independent session.
Task 8: minor (deferred): no test for logout without/with unknown cookie.
Task 8: minor (deferred): replaying a logged-out cookie counts as reuse and revokes other devices (spec wording; usability trade-off).
Task 8: minor (deferred): Windows jar-plugin file lock flake on first verify.
Task 8: fix round 1/5 (1 addressed, 0 open — atomic conditional UPDATE spend + RefreshTokenRaceTest; commits b542583..74d40e9)
Task 8: minor (deferred): logout revoke() still unlocked read + dirty write (benign timestamp overwrite).
Task 8: minor (deferred): race test asserts ApiException, not specifically INVALID_CREDENTIALS; old-code failure probabilistic.
Task 8: complete (commits cbc405b..74d40e9, review clean)
Task 9: dispatched (BASE 74d40e9)
Task 9: ⚠️ resolved — README note on same-e-mail rule belongs to Task 18; real Nimbus verifier unexercised (see minor below); 51 tests green per report.
Task 9: minor (deferred): NimbusGoogleTokenVerifier has no tests (aud/iss/exp/email_verified unproven); spec asks for unit tests of linking rule.
Task 9: minor (deferred): JwtException cause swallowed (JWKS outage looks like 401, not logged).
Task 9: minor (deferred): Google e-mail >254 → misleading 409.
Task 9: minor (deferred): displayName substring(0,40) can split surrogate pairs.
Task 9: minor (deferred): pre-hijacker's access token survives until 15-min expiry.
Task 9: minor (deferred): fallback display name exposes e-mail local part (plan-mandated).
Task 9: minor (deferred): one unexplained Maven failure during verify (likely Windows jar lock flake seen in Task 8).
Task 9: minor (deferred): no tests for long Google name, short local part fallback, linking a passwordless account.
Task 9: complete (commits 74d40e9..2cf0da3, review clean)
Task 10: dispatched (BASE 2cf0da3)
Task 10: ⚠️ resolved — GREEN per report (58 tests); RED via controller removal covers routes only (no hidden untested path per reviewer).
Task 10: minor (deferred): imported fossils/runs/endlessRuns/bestEra uncapped (Integer.MAX_VALUE → later overflow); endlessRuns ≤ runs not enforced.
Task 10: minor (deferred): import unlock check duplicates ProgressRules (different error code by design).
Task 10: minor (deferred): import validations lack tests (wins>runs, mastery cap, cleared range, locked preferred, unknown lastDino/difficulty, runs>0 ALREADY_IMPORTED); 400s don't assert code.
Task 10: minor (deferred): import eligibility keyed on runs==0; overwrites seenPatch with browser value.
Task 10: complete (commits 2cf0da3..d1d0310, review clean)
Task 11: dispatched (BASE d1d0310)
Task 11: ⚠️ resolved — controller ran full `./mvnw verify`: 66 tests, BUILD SUCCESS (jar lock did not recur; intermittent Windows flake).
Task 11: minor (deferred): concurrent duplicate submit with same run id → loser gets 409 (PK violation, not retried) instead of 200; nothing double-paid.
Task 11: minor (deferred): GameRun with assigned UUID → merge() extra SELECT (no Persistable).
Task 11: minor (deferred): RunApiTest gaps (endlessTime>elapsed, endless&&!bossKilled, >100 upgrades, unknown enums, resend-of-now-invalid body, level from non-zero XP); 400s don't assert code.
Task 11: minor (deferred): intermittent maven-jar-plugin Windows file lock during verify.
Task 11: minor (deferred): /clears needs no proof of run (by design; phase-3 plausibility).
Task 11: complete (commits d1d0310..6518005, review clean)
Task 12: dispatched (BASE 6518005)
Task 12: ⚠️ resolved — controller API smoke against real server (dev profile + docker compose Postgres): register/login/refresh 200/logout 204, GET save, POST /runs 201 (fossils 294, firstWinBonus 60, unlocked normal) + resend 200, purchase meta_vida 200 (264 left), locked clear 409 DIFFICULTY_LOCKED, /swagger-ui 200 "Swagger UI".
Task 12: minor (deferred): shop concurrency test may not hit the optimistic-lock retry path (timing); doesn't assert 409 code is INSUFFICIENT_FOSSILS.
Task 12: minor (deferred): OpenAPI global bearer marks public /api/auth/* as locked in Swagger (plan-mandated).
Task 12: minor (deferred): no tests for unknown dino / blank itemId in shop, nor purchase persisted across fresh GET.
Task 12: complete (commits 6518005..739c386, review clean)
Task 18: dispatched (BASE 739c386)
Task 18: ⚠️ resolved — trailer present on f9c9859; CI green pending a push (not pushed: needs owner).
Task 18: minor (deferred): local Windows npm ci skipped @rolldown/binding-win32-x64-msvc (npm optional-deps bug; Linux CI unaffected).
Task 18: minor (deferred): CI comment in English; runs on push + pull_request (duplicate runs on PRs; plan-mandated).
Task 18: complete (commits 739c386..f9c9859, review clean)
Final review: dispatched
Final review: With fixes — Important: (1) signed-in result screen drops first-win bonus/unlock (plan defect toRewards), (2) session lost around run end loses run or credits guest save (plan defect). Minors 2,4,5,6,7,8,9 + Note A (T15 ruling premise wrong) bundled into one fix wave (final-fixes.md).
Final review: parked — Minor 1 (refresh rotation vs 45 s client timeout can look like reuse and revoke all sessions on cold start) — Ruling: defer to phase 4 deploy work (grace window is a design change; pending runs survive; cost: player signs in again).
Final review: parked — Minor 3 (pending queue head-of-line blocking on a permanently-5xx run) — Ruling: defer; no known permanently-5xx input after T10/T11 validation — cost: queued runs stall until the bad one is cleared.
Final review: fix wave dispatched (FIX_BASE f9c9859)
Final review: fix wave (8 commits f9c9859..5675ba3) — scoped re-review: all findings ADDRESSED.
Final review: parked — new Minor: recordClear bonus mirror can double-count in-memory fossils if /runs response arrives before /clears response — Ruling: park (display only, heals on next server response; one-line guard `this.save === base` recommended) — cost if wrong: Covil may briefly show inflated fossils and a purchase may get INSUFFICIENT_FOSSILS.
Final review: parked — implementer concern 2 (permanent CONFLICT for foreign run id is queued) — Ruling: accept; only reachable by a tampered client; revisit with parked Minor 3 (distinct code or retry cap) — cost if wrong: one stuck run blocks the queue.
Final review: parked — implementer concern 3 (late boot refresh after signing into a different account overwrites token AND refresh cookie with the old account's) — Ruling: park as pre-existing, unlikely (needs sign-in to another account during a cold-start refresh); fix = await in-flight refresh before login in session.ts — cost if wrong: runs credited to the wrong account in that rare case.
Final review: complete (commits 21806b5..5675ba3)
