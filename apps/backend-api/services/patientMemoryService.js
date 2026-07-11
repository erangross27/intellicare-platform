/**
 * patientMemoryService.js
 *
 * Per-PATIENT cross-conversation memory for the agent chat (Phases 4 & 5).
 *
 * WHAT IT IS: durable, soft clinical CONTEXT about a patient (concerns raised, working
 * hypotheses, decisions/plans discussed, doctor preferences, open questions) that is
 * auto-recalled into any NEW conversation about that patient so the agent can cross-reference
 * prior discussion against fresh data.
 *
 * WHAT IT IS NOT (lessons from the disabled claudeResponseCache):
 *  - NOT authoritative clinical data. Labs/meds/vitals are ALWAYS re-fetched live via tools.
 *  - NOT cross-tenant. Every store/query is scoped by patientId inside the PRACTICE database
 *    (isolated by DB; patient_agent_memory is registered in secureDataAccess practiceIsolatedCollections).
 *  - Timestamped + provenanced; soft-superseded (status), never treated as current truth.
 *
 * Storage: collection `patient_agent_memory` in the practice DB, `text` field encrypted as PHI.
 * Auth: uses the secure `context` passed in by the caller (never the singleton this.context).
 *
 * Env knobs:
 *  - PATIENT_MEMORY_ENABLED             (default 'true')
 *  - PATIENT_MEMORY_MODEL               (default 'claude-sonnet-5')  [user directive: Sonnet 5, no Haiku]
 *  - PATIENT_MEMORY_RECALL_LIMIT        (default 12)
 *  - PATIENT_MEMORY_MIN_INTERVAL_MS     (default 480000 = 8 min) debounce between extractions per session
 *  - PATIENT_MEMORY_MAX_ITEMS           (default 8) max items per extraction
 *  - PATIENT_MEMORY_MAX_OUTPUT_TOKENS   (default 1500)
 *  - PATIENT_MEMORY_TIMEOUT_MS          (default 45000)
 */

const Anthropic = require('@anthropic-ai/sdk');

const COLLECTION = 'patient_agent_memory';
const SESSIONS_COLLECTION = 'chat_sessions';
const VALID_TYPES = ['concern', 'hypothesis', 'plan', 'preference', 'problem', 'fact-discussed', 'summary'];

const cfg = () => ({
  enabled: (process.env.PATIENT_MEMORY_ENABLED || 'true').toLowerCase() !== 'false',
  model: process.env.PATIENT_MEMORY_MODEL || 'claude-sonnet-5',
  recallLimit: parseInt(process.env.PATIENT_MEMORY_RECALL_LIMIT, 10) || 12,
  minIntervalMs: parseInt(process.env.PATIENT_MEMORY_MIN_INTERVAL_MS, 10) || 8 * 60 * 1000,
  maxItems: parseInt(process.env.PATIENT_MEMORY_MAX_ITEMS, 10) || 8,
  maxOutputTokens: parseInt(process.env.PATIENT_MEMORY_MAX_OUTPUT_TOKENS, 10) || 1500,
  timeoutMs: parseInt(process.env.PATIENT_MEMORY_TIMEOUT_MS, 10) || 45000,
});

// ---- Anthropic client (lazy, cached) ------------------------------------
let _client = null;
async function getClient() {
  if (_client) return _client;
  const productionKMS = require('./productionKMS');
  if (!productionKMS.initialized) await productionKMS.initialize();
  const apiKey = await productionKMS.getInternalKey('CLAUDE_API_KEY')
    || await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('No Claude/Anthropic API key in KMS for patient memory');
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---- encryption helpers -------------------------------------------------
async function encryptText(text) {
  const encryptionService = require('./encryptionService');
  return encryptionService.encrypt(String(text), 'phi');
}
async function decryptText(value) {
  if (value && typeof value === 'object' && (value.encrypted || value.iv)) {
    try {
      const encryptionService = require('./encryptionService');
      return await encryptionService.decrypt(value);
    } catch (_) {
      return '[encrypted memory — decryption failed]';
    }
  }
  return typeof value === 'string' ? value : String(value ?? '');
}

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---- recall (Phase 5) ---------------------------------------------------
/**
 * Fetch active memories for a patient (newest first) with decrypted text.
 * @returns {Promise<Array<{_id,type,text,createdAt,confidence,...}>>}
 */
async function recall({ context, patientId, limit } = {}) {
  const conf = cfg();
  if (!conf.enabled || !patientId) return [];
  const SecureDataAccess = require('./secureDataAccess');
  const docs = await SecureDataAccess.query(
    COLLECTION,
    { patientId: String(patientId), status: 'active' },
    { sort: { createdAt: -1 }, limit: limit || conf.recallLimit },
    context
  );
  return Promise.all((docs || []).map(async (d) => ({ ...d, text: await decryptText(d.text) })));
}

/** Format recalled memories into a system-prompt block (or '' if none). */
function formatMemoryBlock(items, patientName) {
  if (!items || items.length === 0) return '';
  const fmtDate = (d) => {
    try { return new Date(d).toISOString().split('T')[0]; } catch (_) { return ''; }
  };
  const lines = items.map((m) => {
    const when = fmtDate(m.createdAt);
    const tag = m.type ? `[${m.type}]` : '';
    return `• ${when ? when + ' ' : ''}${tag} ${m.text}`;
  }).join('\n');
  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 REMEMBERED CONTEXT ABOUT THIS PATIENT${patientName ? ` (${patientName})` : ''} — from PRIOR conversations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The notes below are things discussed with this patient in EARLIER conversations, with dates.
Use them to cross-reference and provide continuity of care (e.g. "last time we were tracking X").

⚠️ These are REMEMBERED notes, NOT current clinical data and possibly outdated. Before stating any
clinical value (labs, medications, vitals, doses, problem status), RE-FETCH it with the appropriate
tool and compare against these notes. If a note conflicts with current data, trust the tool.

${lines}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/** Convenience: recall + formatted block in one call. */
async function recallBlock({ context, patientId, patientName, limit } = {}) {
  const items = await recall({ context, patientId, limit });
  return { items, block: formatMemoryBlock(items, patientName) };
}

// ---- write (Phase 4) ----------------------------------------------------
/**
 * Insert new memory items for a patient, skipping near-duplicates of existing active memories.
 * @param {Array<{type,text,confidence}>} items
 * @returns {Promise<{inserted:number, skipped:number}>}
 */
async function write({ context, patientId, userId, sessionId, items } = {}) {
  const conf = cfg();
  if (!conf.enabled || !patientId || !Array.isArray(items) || items.length === 0) {
    return { inserted: 0, skipped: 0 };
  }
  const SecureDataAccess = require('./secureDataAccess');

  // Dedup against existing active memories (decrypted) by normalized text.
  const existing = await recall({ context, patientId, limit: 200 });
  const existingNorms = new Set(existing.map((m) => norm(m.text)));

  const MAX_ITEM_CHARS = 600; // hard per-item bound so the recalled memory block can't bloat the prompt
  let inserted = 0, skipped = 0;
  for (const raw of items.slice(0, conf.maxItems)) {
    let text = String(raw.text || '').trim();
    if (!text) { skipped++; continue; }
    if (text.length > MAX_ITEM_CHARS) text = text.slice(0, MAX_ITEM_CHARS).trim() + '…';
    const n = norm(text);
    // Skip only true duplicates: an exact match, or a LONGER existing note that already fully
    // covers this one. Do NOT skip a richer new note just because it contains a shorter existing
    // one as a substring (that dropped legitimate updates). Guard against empty existing strings.
    if (existingNorms.has(n) || [...existingNorms].some((e) => e && e.length > 0 && e.includes(n))) {
      skipped++; continue;
    }
    const type = VALID_TYPES.includes(raw.type) ? raw.type : 'fact-discussed';
    const doc = {
      patientId: String(patientId),
      userId: userId || null,
      sourceSessionId: sessionId || null,
      type,
      text: await encryptText(text),
      status: 'active',
      confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.7,
      supersededBy: null,
      createdAt: new Date(),
      lastConfirmedAt: new Date(),
      version: 1,
    };
    try {
      await SecureDataAccess.insert(COLLECTION, doc, context);
      existingNorms.add(n);
      inserted++;
    } catch (e) {
      console.error(`[PatientMemory] insert failed: ${e.message}`);
      skipped++;
    }
  }
  if (inserted) console.log(`🧠 [PatientMemory] Stored ${inserted} new memory item(s) for patient ${patientId} (skipped ${skipped} dup/empty).`);
  return { inserted, skipped };
}

// ---- extraction (Sonnet) ------------------------------------------------
const EXTRACT_SYSTEM_PROMPT = `You extract DURABLE, cross-conversation memory from a conversation between a DOCTOR and an AI clinical assistant, for continuity of care.

Return ONLY a JSON array (no prose, no code fences). Each element:
{ "type": one of ["concern","hypothesis","plan","preference","problem","fact-discussed"], "text": "concise note", "confidence": 0.0-1.0 }

Capture things worth remembering NEXT time this patient comes up:
• Clinical CONCERNS the doctor raised, working HYPOTHESES, and PLANS/decisions made or being weighed.
• Active PROBLEMS being tracked over time and what to watch.
• Doctor PREFERENCES about how to present or handle this patient.
• Notable facts DISCUSSED that give continuity ("was started on X and we planned to re-check in 2 weeks").

Hard rules:
• Do NOT invent or infer values. Include ONLY what actually appears. Preserve identifiers/numbers/units verbatim.
• Do NOT store transient chit-chat, UI actions, or a raw dump of a data table — the live data lives in the database and will be re-fetched. Store the CONTEXT/decision, not the data snapshot.
• Prefer a SMALL number of high-signal notes (0 to ~8). If nothing durable was discussed, return [].
• Each note self-contained and dated by context if relevant. Output MUST be valid JSON only.`;

function parseItems(text) {
  if (!text) return [];
  let t = text.trim();
  // strip code fences if the model added them
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  // isolate the first JSON array if there's stray text
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    const arr = JSON.parse(t);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x.text === 'string' && x.text.trim());
  } catch (_) {
    return [];
  }
}

/** Build a compact transcript from recent turns ({role, content}). */
function buildTranscript(recentTurns) {
  const PER = 6000;
  return (recentTurns || [])
    .map((m) => {
      const who = m.role === 'user' ? 'Doctor' : 'Assistant';
      let c = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
      if (c.length > PER) c = c.slice(0, PER) + ' …[truncated]';
      return `${who}: ${c}`;
    })
    .join('\n\n');
}

async function extract({ recentTurns, patientName } = {}) {
  const conf = cfg();
  const transcript = buildTranscript(recentTurns);
  if (!transcript.trim()) return [];
  const client = await getClient();
  const call = client.messages.create({
    model: conf.model,
    max_tokens: conf.maxOutputTokens,
    system: EXTRACT_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Patient: ${patientName || '(unknown)'}\n\nConversation excerpt:\n"""\n${transcript}\n"""\n\nReturn the JSON array of durable memory items.`,
    }],
  });
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`memory extraction timed out after ${conf.timeoutMs}ms`)), conf.timeoutMs)
  );
  const resp = await Promise.race([call, timeout]);
  const out = (resp?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return parseItems(out);
}

// ---- session context read + per-patient debounce meta -------------------
async function getSessionCtx(sessionId, context) {
  const SecureDataAccess = require('./secureDataAccess');
  try {
    const s = await SecureDataAccess.query(SESSIONS_COLLECTION, { sessionId }, { limit: 1 }, context);
    return (s && s[0] && s[0].context) || {};
  } catch (_) { return {}; }
}
// Debounce is keyed PER PATIENT (not per session), so a session that discusses patient B after
// patient A within the window still writes B's memory.
async function setMemoryMetaForPatient(sessionId, patientId, meta, context) {
  // patientId is interpolated into a Mongo field path below — only allow safe 24-hex keys
  // (defense-in-depth; effPatientId is a Mongo ObjectId in every real path).
  if (!/^[0-9a-fA-F]{24}$/.test(String(patientId))) return;
  const SecureDataAccess = require('./secureDataAccess');
  try {
    await SecureDataAccess.update(
      SESSIONS_COLLECTION,
      { sessionId },
      { $set: { [`context.memoryMeta.${patientId}`]: meta } },
      context
    );
  } catch (e) { console.warn(`[PatientMemory] could not persist memoryMeta: ${e.message}`); }
}

/**
 * Debounced extract+write. Safe to fire-and-forget: never throws.
 * Re-resolves the patient from the session (updated by the agent during the turn) so notes are
 * never stored under a stale/wrong patientId. Debounce is per (session, patient).
 */
async function maybeExtractAndWrite({ context, patientId, patientName, userId, sessionId, recentTurns, force = false } = {}) {
  try {
    const conf = cfg();
    if (!conf.enabled || !sessionId) return { skipped: true, reason: 'disabled/missing-ids' };

    const sessCtx = await getSessionCtx(sessionId, context);
    // Prefer the patient the agent actually settled on this turn (persisted to context.currentPatient
    // during the loop) over the pre-loop hint — this prevents cross-patient contamination.
    const effPatientId = (sessCtx.currentPatient && sessCtx.currentPatient.patientId) || patientId;
    const effPatientName = (sessCtx.currentPatient && sessCtx.currentPatient.name) || patientName;
    if (!effPatientId) return { skipped: true, reason: 'no-patient' };

    const perPatient = sessCtx.memoryMeta && sessCtx.memoryMeta[effPatientId];
    if (!force && perPatient?.lastExtractedAt) {
      const elapsed = Date.now() - new Date(perPatient.lastExtractedAt).getTime();
      if (elapsed < conf.minIntervalMs) return { skipped: true, reason: 'debounced' };
    }

    const items = await extract({ recentTurns, patientName: effPatientName });
    // Advance the per-patient debounce clock so we don't retry extraction every turn.
    await setMemoryMetaForPatient(sessionId, effPatientId, { lastExtractedAt: new Date(), lastCount: items.length }, context);

    if (items.length === 0) return { skipped: false, inserted: 0 };
    const res = await write({ context, patientId: effPatientId, userId, sessionId, items });
    return { skipped: false, ...res };
  } catch (e) {
    console.error(`[PatientMemory] maybeExtractAndWrite failed (non-fatal): ${e.message}`);
    return { skipped: true, reason: 'error', error: e.message };
  }
}

// ---- GUI support (Phase 6) ---------------------------------------------
async function list({ context, patientId, includeDismissed = false, limit = 100 } = {}) {
  const SecureDataAccess = require('./secureDataAccess');
  const filter = { patientId: String(patientId) };
  if (!includeDismissed) filter.status = 'active';
  const docs = await SecureDataAccess.query(COLLECTION, filter, { sort: { createdAt: -1 }, limit }, context);
  return Promise.all((docs || []).map(async (d) => ({ ...d, text: await decryptText(d.text) })));
}

async function setStatus({ context, memoryId, status } = {}) {
  const SecureDataAccess = require('./secureDataAccess');
  const { ObjectId } = require('mongodb');
  const _id = typeof memoryId === 'string' ? new ObjectId(memoryId) : memoryId;
  return SecureDataAccess.update(COLLECTION, { _id }, { $set: { status, updatedAt: new Date() } }, context);
}
async function dismiss(args) { return setStatus({ ...args, status: 'dismissed' }); }

async function updateText({ context, memoryId, text } = {}) {
  const SecureDataAccess = require('./secureDataAccess');
  const { ObjectId } = require('mongodb');
  const _id = typeof memoryId === 'string' ? new ObjectId(memoryId) : memoryId;
  return SecureDataAccess.update(COLLECTION, { _id }, { $set: { text: await encryptText(text), lastConfirmedAt: new Date(), updatedAt: new Date() } }, context);
}

module.exports = {
  recall,
  recallBlock,
  formatMemoryBlock,
  write,
  extract,
  parseItems,        // exported for testing
  buildTranscript,   // exported for testing
  maybeExtractAndWrite,
  list,
  setStatus,
  dismiss,
  updateText,
  _VALID_TYPES: VALID_TYPES,
};
