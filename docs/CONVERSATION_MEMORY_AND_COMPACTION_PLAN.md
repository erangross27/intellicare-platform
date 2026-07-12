# Conversation Compaction + Per‑Patient Cross‑Conversation Memory — Implementation Plan

Status: **In progress** (Phase 1 implemented). Owner: agent chat platform.
Live chat path: `POST /agent-sdk/chat` → `routes/agent.js:16186` → `services/agentSDKService.js`.
Model: `claude-sonnet-5` (agent), **`claude-sonnet-5` (compaction)**, `claude-sonnet-5` (memory writer). Per user: use Sonnet 5 everywhere; Haiku 4.5 is not to be used. All model ids are env‑overridable (`COMPACTION_MODEL`, etc.).

---

## 0. Goals

1. **Remove the legacy 20‑message cap** (`agentSDKService.js:504`) — a 200K‑context‑era holdover. We are on the 1M window now; window by **tokens**, not a fixed message count.
2. **Conversation compaction (Claude Code style)** — when a conversation approaches a token threshold (with headroom reserved so the compaction call itself fits), summarize the older turns, keep a verbatim recent tail, continue, and **show a "compacted" marker in the GUI**.
3. **Per‑patient cross‑conversation memory** — durable, per‑**patient** memory that is **auto‑loaded** into any new conversation about that patient so the agent can cross‑reference prior discussion against fresh data.

## Non‑goals / hard rules (lessons from the disabled `claudeResponseCache`)

- **Never cache answers or store clinical values as truth.** Memory holds *soft context* (concerns, hypotheses, decisions, preferences, narrative). Labs/meds/vitals are **always re‑fetched live via tools**.
- **Scope every store/query by `practiceId` + `patientId`.** The old cache keyed on `MD5(query+language)` only → cross‑tenant collisions. Never repeat that.
- **Every memory is timestamped + provenanced**, soft‑expired (superseded, not overwritten), and **doctor‑visible/editable**.

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Memory scope | **Per patient** (shared across the patient's conversations within a practice) |
| Recall trigger | **Auto‑load** when the current patient is known |
| Compaction trigger | **Auto** (with reserved headroom) **+ manual "Compact now"** button |
| Memory visibility | **Visible + editable** ("What I remember about this patient" panel) |
| Memory write timing | On **compaction** + on **conversation end / idle** |
| Summarizer models | **Sonnet 5** for both compaction and durable memory (user directive: no Haiku). Env‑overridable. |

---

## Current‑state facts (verified in code)

- History cap: `MAX_HISTORY_MESSAGES = 20; slice(-20)` — `agentSDKService.js:504‑510`.
- Route loads **all** session messages (no limit), decrypts, maps `type user/agent → role user/assistant`, stringifies content — `routes/agent.js:16118‑16164`. Sequence numbers are **dropped** in the mapping (16161‑16164).
- Per‑loop token guard: `MAX_CONVERSATION_TOKENS = 980000`, estimate `ceil(JSON.stringify(messages).length/4)`, on exceed → `break` (no compaction) — `agentSDKService.js:702, 971‑985`.
- Prompt caching: `cache_control: ephemeral` on the **system prompt block** — `agentSDKService.js:1003‑1009`. Patient context is injected into that system prompt (`patientContextBlock`, `:713‑740, 776`).
- Patient context persisted at `chat_sessions.context.currentPatient` — `agentSDKService.js:581‑593, 1318‑1326`.
- `ChatMessage` (`models/ChatMessage.js`): `type ∈ {user, agent}` (28‑32), `content` Mixed/encrypted (35‑38), `sequenceNumber` (88‑91), `actionResult` holds tool output (53‑56). **No `patientId`.**
- `ChatSession` (`models/ChatSession.js`): free‑form `context` Object (58‑63), plain‑string `summary` (66‑69), `artifactState` (72‑76). **No `patientId`.**
- No cross‑conversation memory / embeddings exist today; reusable blocks: `services/secureDataAccess.js` (the only authorized per‑practice Mongo gateway), Anthropic client init (`agentSDKService.js:54‑78`), unused Atlas `$vectorSearch` endpoint (`routes/agent.js:4935`).

---

## Architecture

```
                      ┌───────────────────────────────────────────────┐
  POST /agent-sdk/chat│  routes/agent.js                              │
        │             │  load chat_messages (all) ──► decrypt         │
        ▼             │        │                                      │
  conversationCompactionService.prepareHistory({sessionId, messages}) │  ← NEW (Phase 2)
        │  returns {summaryText, tailMessages, events}                │
        ▼             │        │                                      │
  patientMemoryService.recall({practiceId, patientId})  ← NEW (Ph.5)  │
        │  returns memoryBlock text                                   │
        ▼             └───────────────────────────────────────────────┘
  agentSDKService.processChatMessageWithAgent(
        userMessage, ..., conversationHistory=tailMessages,
        sessionId, conversationSummary=summaryText, patientMemory=memoryBlock)
        │
        ├─ system prompt = SYSTEM_PROMPT + date + patientContext
        │                 + conversationSummaryBlock  ← Phase 2
        │                 + patientMemoryBlock         ← Phase 5   (all inside the cached system block)
        └─ messages = verbatim recent tail + current user message
```

Compaction and memory are **history‑preparation concerns** kept OUT of the agentic loop; `agentSDKService` only *consumes* the prepared summary/memory by injecting them into the (already cached) system prompt — exactly the pattern `patientContextBlock` already uses.

---

## Data model additions

### `chat_messages` (additive, backward compatible)
- Extend `type` enum → `['user', 'agent', 'compaction']`.
- Add optional `compaction` sub‑doc: `{ coversFromSeq, coversToSeq, tokensBefore, tokensAfter, model, trigger: 'auto'|'manual' }`.
- Add optional `patientId` (indexed) so a message can be linked to a patient (enables per‑patient queries + memory provenance).

### `chat_sessions`
- Add `context.compaction = { summary, coversToSeq, tokenEstimate, updatedAt, model }` (the rolling checkpoint the compaction service reads/writes).
- Add optional top‑level indexed `patientId` (denormalized "primary patient of this session") for fast per‑patient lookup.

### NEW collection `patient_agent_memory` (per‑practice DB, via `SecureDataAccess`)
```
{
  _id, practiceId, patientId (indexed), userId (author doctor),
  type: 'summary'|'concern'|'hypothesis'|'plan'|'preference'|'fact-discussed',
  text,                       // PHI — encrypted like chat_messages.content
  sourceSessionId, sourceMessageIds,
  createdAt, lastConfirmedAt,
  supersededBy: null,         // soft‑expiry, never mutated in place
  status: 'active'|'superseded'|'dismissed',
  confidence: 0..1
}
```
Index: `{ practiceId: 1, patientId: 1, status: 1, createdAt: -1 }`.

---

## Phases

### Phase 1 — Remove 20‑cap, token‑based windowing ✅ (DONE)
`agentSDKService.js`: replace the fixed `slice(-20)` with a token‑budgeted window — keep the most‑recent messages that fit under `HISTORY_INPUT_BUDGET_TOKENS` (default 500K, env‑overridable). If everything fits, send all (the 1M win). If not, keep the recent window (graceful; Phase 2 will summarize the deferred part instead of dropping it). Self‑contained, no schema/route change.

### Phase 2 — Compaction service (backend) ✅ (DONE — logic unit-tested, 17/17)
- NEW `services/conversationCompactionService.js`:
  - `prepareHistory({ sessionId, messages, secureContext, onEvent, force })` → reads `chat_sessions.context.compaction`, computes the verbatim tail (messages after `coversToId`), estimates tokens; if `summary+tail` exceeds `COMPACTION_TRIGGER_TOKENS` (**default 150000**, generous headroom for the summarizer call + response) AND tail > `COMPACTION_KEEP_RECENT_MESSAGES` (default 30), summarizes the oldest slice with **Sonnet 5** (structured medical template, **no invented values**), persists a rolled-forward checkpoint on `chat_sessions.context.compaction`, emits `onEvent({type:'compacted', ...})`. Returns `{ summaryText, tailMessages, compacted }`.
  - **Fail-safe:** never throws into the chat path; on LLM error/timeout/DB failure returns the full history unchanged (45s summary timeout).
  - **Checkpoint-only (no `chat_messages` marker row)** — avoids ordering/duplication with the frontend's own message persistence; GUI renders the marker from the checkpoint + the live SSE event.
  - `compactNow(...)` implemented (loads+decrypts session, forces a fold) — ready for the Phase 3 manual button.
- `routes/agent.js` (~16150): calls `prepareHistory` right after decrypting history; maps the returned tail into `conversationHistory`; forwards `summaryText` as the new 9th arg; streams `compacted` events via `sendChunk`.
- `agentSDKService.js`: new `conversationSummary` param (method @147, wrapper @2017/2019) → injects `conversationSummaryBlock` into the cached system prompt (`:776`) with the "SUMMARY not verbatim — re-fetch exact values via tools" guardrail.
- Env knobs: `COMPACTION_ENABLED`, `COMPACTION_TRIGGER_TOKENS`, `COMPACTION_KEEP_RECENT_MESSAGES`, `COMPACTION_MODEL`, `COMPACTION_MAX_OUTPUT_TOKENS`, `COMPACTION_TIMEOUT_MS`.
- Deferred to Phase 3 (ships with the button): `POST /agent-sdk/session/:sessionId/compact`.

### Phase 3 — Compaction GUI ✅ (DONE)
- **Marker:** copy the existing non‑chat divider pattern — `MessageList.jsx:261` already special‑cases `type === 'batch_summary' → <SummaryCard>`. Add a sibling `type === 'compaction_marker' → <CompactionDivider>` (new file `components/chat/components/CompactionDivider.jsx`). No change to `Message.jsx` needed.
- **Live event:** backend emits SSE `{ type: 'compacted', ... }`; handle it in the if/else chain at `ChatContainer.jsx:1444‑1622` (push a `compaction_marker` message).
- **SSE plumbing already exists:** fetch+ReadableStream reader in `services/secureApiClient.js:609` (`streamingPost`), `data:` lines → `onChunk` at `:657`.
- **"Compact now" button** in the chat header → `secureApi.post('/api/agent/agent-sdk/session/'+sessionId+'/compact')`.

### Phase 6 — Memory GUI panel ✅ (DONE)
- Clone the **ArtifactPanel** open/close pattern in `ChatContainer.jsx`: new `memoryPanelOpen` state (localStorage‑backed like `:131`), lazy `<MemoryPanel patientId={artifactPatientId} onClose=.../>` rendered beside the ArtifactPanel block at `ChatContainer.jsx:3117‑3135`.
- Current patient id is already tracked as `artifactPatientId` (`ChatContainer.jsx:139`, localStorage) — the memory panel + auto‑load key off it directly.
- Data via `secureApi.get('/api/patient-memory?patientId=...')` (singleton in `services/secureApiClient.js`; called inline, no registration step).
- Endpoints: `GET/PATCH/DELETE /patient-memory`.

### Phase 4 — Per‑patient memory store + writer (backend) ✅ (DONE — logic unit‑tested, 17/17)
- NEW `services/patientMemoryService.js`: `recall/recallBlock`, `write` (dedup vs active), `extract` (Sonnet 5 → strict‑JSON items, robust parser), `maybeExtractAndWrite` (debounced), `list/setStatus/dismiss/updateText` (Phase 6 GUI). All via `SecureDataAccess`, `text` PHI‑encrypted, scoped by `patientId` inside the practice DB.
- Collection `patient_agent_memory` registered in `secureDataAccess.js` `practiceIsolatedCollections` (isolated by practice DB; no cross‑tenant bleed — the exact failure of the old response cache).
- **Write trigger — DESIGN REFINEMENT:** instead of only "on compaction + end", the write is a **debounced, fire‑and‑forget extraction after each qualifying turn** (default: at most once per 8 min per session, `PATIENT_MEMORY_MIN_INTERVAL_MS`). This runs AFTER the response is streamed (zero user latency) and covers **short AND long** conversations automatically with **no frontend changes**. Context is snapshotted (`{...this.context}`) to survive the singleton being reused by a concurrent request.
- Items: `{type ∈ concern|hypothesis|plan|preference|problem|fact‑discussed|summary, text, confidence}`, stored with `status:'active'`, `createdAt`, `sourceSessionId`, `userId`, `supersededBy`. Env: `PATIENT_MEMORY_ENABLED|MODEL|RECALL_LIMIT|MIN_INTERVAL_MS|MAX_ITEMS|MAX_OUTPUT_TOKENS|TIMEOUT_MS`.

### Phase 5 — Memory reader / auto‑load (backend) ✅ (DONE)
- `agentSDKService.js` (~line 660): after `currentPatient` is resolved, calls `patientMemoryService.recallBlock({context:this.context, patientId, patientName})` and injects `patientMemoryBlock` into the cached system prompt (`:842`, between `patientContextBlock` and `conversationSummaryBlock`).
- Guardrail baked into the block: *"REMEMBERED notes, NOT current clinical data and possibly outdated — RE‑FETCH labs/meds/vitals/doses via tools and trust the tool on conflict."*
- No route change needed (patientId resolved inside the service from `session.context.currentPatient`).
- **Deferred to Phase 6:** REST endpoints `GET/PATCH/DELETE /patient-memory` (service methods `list/updateText/setStatus/dismiss` already exist).

### Phase 6 — Memory GUI panel
- Collapsible "What I remember about this patient" panel (reuse the artifact‑panel open/close pattern): list active memories with dates; edit / delete / dismiss; "why is this here?" provenance.
- Endpoints: `GET/PATCH/DELETE /patient-memory` (scoped by practice+patient+auth).

### Phase 7 — Safety, audit, retention, tests
- Audit every memory read/write; retention policy; RBAC (only the patient's practice); unit + integration tests; load test compaction on a synthetic long conversation.

---

## Cost (illustrative; verify current Sonnet‑5 rates — Sonnet 5 used for all summarization per user)
- Compaction: ~1 Sonnet pass when a threshold is crossed → injected summary replaces re‑sending 100K+ raw tokens → **net token savings**.
- Memory write: ~1 Sonnet pass at most once per 8 min per active session (~5–10K in + ~1K out) → a few cents; storage negligible.
- Memory recall: DB query + ~1–2K tokens injected into the **cached** system prompt → ≈ $0 marginal per turn.
- Net: cross‑conversation memory is *cheaper* than re‑sending long transcripts, and it's the only design that crosses conversations.

## Rollback / flags
- `HISTORY_INPUT_BUDGET_TOKENS`, `COMPACTION_TRIGGER_TOKENS`, `COMPACTION_ENABLED`, `PATIENT_MEMORY_ENABLED` — all env‑gated so any phase can be disabled without redeploy. Do **not** re‑enable `claudeResponseCache` (answer caching is the wrong tool for live medical data).

---

## Final status & QA — ALL PHASES COMPLETE (backend + frontend + endpoints)

**Files created:** `services/conversationCompactionService.js`, `services/patientMemoryService.js`, `components/chat/components/CompactionDivider.jsx`, `components/chat/MemoryPanel.jsx`.
**Files edited:** `services/agentSDKService.js`, `routes/agent.js`, `services/secureDataAccess.js`, `components/chat/components/MessageList.jsx`, `components/chat/ChatContainer.jsx`.
**Endpoints added:** `POST /api/agent/agent-sdk/session/:sessionId/compact`, `GET/PATCH/DELETE /api/agent/agent-sdk/patient-memory`.

**QA performed (this session):**
- `node --check` clean on all 5 backend files.
- `@babel/parser` (jsx) parse‑clean on all 4 frontend files.
- 2 hermetic unit‑test suites, 34 assertions, all green (compaction folding/debounce/reuse; memory parse/dedup/recall/debounce/encryption).
- **1M context confirmed intact:** model `claude-sonnet-5`, `MAX_CONVERSATION_TOKENS = 980000` unchanged; `HISTORY_INPUT_BUDGET_TOKENS` (500K) is a history SUB‑cap, not a context‑window reduction.
- Frontend contract verified against the working chat call: prefix `/api/agent/...`, `secureApi` returns the JSON body, CSRF auto‑handled in `request()`, `displayMessages = messages` (no type filtering → `compaction_marker` renders).
- Param threading verified end‑to‑end: route → wrapper(2070) → method(147), 10 args, `bodyPatientId → requestPatientId → memoryPatientId`.

**Token savings:** compaction replaces re‑sending raw history with a summary (net saving); memory recall injects ~1–2K tokens into the CACHED system block (stable turn‑to‑turn → cache hits); memory write is debounced (≤1 Sonnet call / 8 min / session); recall + write are skipped entirely when no patient is in scope.

**Known limitations (by design, safe):**
- Compaction markers are live SSE indicators, not persisted messages → they don't reappear after a page reload (the summary itself persists in `chat_sessions.context.compaction`).
- Turn‑1 recall in a brand‑new conversation requires a patient selected in the UI (`artifactPatientId`); otherwise memory loads from turn 2 (once the agent identifies the patient).
- Compaction runs synchronously on the turn it fires (one Sonnet summary of latency, infrequent). Memory extraction/write is async → no user‑facing latency.
- Floating 🧠/🗜️ controls are position‑fixed top‑corner (shift for the artifact panel + memory drawer); reposition if they clash with other UI once you test.

---

## Adversarial review round (2 independent reviewers) + fixes applied

Two independent agents audited the full backend + frontend diffs. **No crash / scope / TDZ / arg‑count / hooks bugs; chat path proven unbreakable.** Real findings were fixed:

**Backend (data‑integrity — important for PHI):**
- **Cross‑patient write (MED) — FIXED.** `memoryPatientId` was resolved BEFORE the agent ran, so a turn about patient B (with patient A open) could store B's notes under A. The write now **re‑resolves the patient from `chat_sessions.context.currentPatient`** (updated by the agent during the turn) in `patientMemoryService.maybeExtractAndWrite`, preferring it over the pre‑loop hint.
- **Ineffective context snapshot / concurrency (MED) — FIXED.** Recall/write used the singleton's live `this.context` (a concurrent request can overwrite it). Now they use `memServiceContext`, captured at request start (`agentSDKService.js:203`).
- **Per‑session debounce dropped 2nd patient (MED) — FIXED.** Debounce is now keyed **per (session, patient)** (`context.memoryMeta.<patientId>`), so patient B in the same session within 8 min still gets memory.
- **Guaranteed collection authorization (LOW→important) — FIXED.** Memory/compaction contexts now use `serviceId:'agent-route'` (a registered **system service**, `allowedCollections:['*']`), so `patient_agent_memory` writes work with **no ServiceAccount migration**.
- **Over‑aggressive dedup (LOW) — FIXED.** Removed the `n.includes(e)` direction (kept richer updates) and guarded empty strings.
- **Compaction stale‑anchor overlap + `"undefined"` id (LOW) — FIXED.** Rebuilds cleanly when the covered anchor is missing; guards `coversToId`.

**Frontend (polish) — FIXED:** drawer no longer occludes the compact button; compact button has an in‑flight guard + unique marker id; memory panel remounts per patient (`key`).

### Security review (IDOR) — FIXED
Automated commit + push security review flagged 3 HIGH IDOR issues on the new REST endpoints / client‑supplied patientId. Confirmed real (IntelliCare enforces per‑clinician patient access via `rbacService` `patientGroupAccess.assignedPatients`, and `chat_sessions` are user‑owned). Fixed in `routes/agent.js` with fail‑closed guards:
- **`GET /patient-memory`** → `assertPatientAccess(req, patientId)` (patient must exist in the caller's practice; if the user has an explicit `assigned`/`department` scope, it's enforced; unrestricted users are never blocked).
- **`PATCH`/`DELETE /patient-memory/:id`** → `assertMemoryAccess` (loads the memory, resolves its `patientId`, applies `assertPatientAccess`).
- **`POST /session/:id/compact`** → `assertSessionOwner` (session `userId` must match the caller).
- **Chat route** → the client‑supplied `bodyPatientId` used for turn‑1 recall is now ignored unless `assertPatientAccess` passes (prevents cross‑patient memory disclosure via a forged body `patientId`). Agent‑resolved `currentPatient` is unchanged (consistent with the agent's existing practice‑level data access).

The `agent-route` system context is used only to run these internal lookups; **authorization is enforced explicitly in code**, and every lookup is scoped to the caller's practice (cross‑tenant impossible).

Note: the broader observation that the AGENT's own data tools (`getMedications`, `searchPatientsByName`) don't apply `assignedPatients` RBAC is **pre‑existing** app behaviour, out of scope here — worth a separate app‑wide review.

### Review round 2 (re‑verification after fixes) — all 6 fixes VERIFIED‑CORRECT
An independent agent re‑audited the post‑fix code: every fix confirmed correct; original bugs resolved; **no exception can escape into the chat**; `agent-route` confirmed to authorize `chat_sessions`/`patient_agent_memory` (validates the "no per‑collection grant needed" conclusion). Two further items were then fixed:
- **CSV‑import mis‑attribution (MED) — FIXED.** The background write now **skips bulk CSV imports** (`csvType==='patients'|'users'`) so import turns can't attach spurious notes to a stale patient (`agentSDKService.js:1789`).
- **Debounce field‑path hardening (LOW) — FIXED.** `setMemoryMetaForPatient` now rejects non‑24‑hex `patientId` before using it as a Mongo field path (defense‑in‑depth).

**Collection permissions (answer to "does the service have write permission?"):** No per‑collection grant needed. MongoDB roles here are **database‑scoped** (`readWrite`/`root`), never per‑collection → new collections in the practice DB are auto‑writable (proven by `chat_messages`/`medications`). App‑level, `patient_agent_memory` is accessed via `serviceId:'agent-route'`, a **system service** (`secureDataAccess.js:1141`) whose `isCollectionAllowed` returns true for any collection. Runtime signal to watch on first test: `🧠 [PatientMemory] Stored …` (works) vs `SECURITY: Insert … not allowed …` (would mean `agent-route` isn't a system service in the deployed build).

### Singleton `this.context` concurrency race — FIXED
`agentSDKService` is a process‑wide singleton; `this.context` was set per request and could be clobbered by a concurrent request for a *different* practice between `await`s, so tool execution / patient‑context I/O could run under the wrong `practiceId` (cross‑practice PHI risk under concurrency). Blast radius was small (6 refs; `executeTool` depended on `this.context` only, single caller). Fixed by building a **request‑local `const requestContext`** and threading it explicitly: the patient‑context session read (`:629`) + write (`:1417`) use it, and `executeTool(toolName, args, context)` now receives it from the agentic loop (`:1392`), falling back to `this.context` only for legacy callers. `this.context` retained as a back‑compat fallback. Service tests still green.

### Still NOT changed — needs your product decision
- **`assignedPatients` RBAC on the agent's own data tools (pre‑existing).** The agent (`getMedications`, `searchPatientsByName`, etc.) accesses any patient in the practice — it does not apply the per‑clinician `patientGroupAccess` restriction that the new memory endpoints now enforce. Making the agent enforce it is a **behavior/policy change** (it would stop a restricted clinician from asking the agent about a non‑assigned patient) — a product decision, not a bug fix, so it is intentionally left for you to decide rather than changed unilaterally.
- **`patient_agent_memory` secondary index** — skipped: `SecureDataAccess` exposes no index API, so adding one means bypassing the secure data layer. It's a scale‑only optimization (per‑patient memory counts are small; queries are correct without it). Add later via your DB migration tooling if volume grows.
