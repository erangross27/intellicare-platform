/**
 * conversationCompactionService.js
 *
 * Claude-Code-style conversation compaction for the agent chat (SDK path).
 *
 * Purpose: keep long doctor↔agent conversations inside the context window WITHOUT
 * losing early context. When the running conversation crosses a token threshold, the
 * OLDER turns are folded into a rolling summary while a verbatim RECENT tail is kept.
 * The summary is injected into the (cached) system prompt by agentSDKService; only the
 * recent tail is sent as verbatim `messages`.
 *
 * Design principles (see CONVERSATION_MEMORY_AND_COMPACTION_PLAN.md):
 *  - History-PREPARATION concern: lives outside the agentic loop.
 *  - NEVER throws into the chat path. On ANY failure (LLM error/timeout/db) it returns
 *    the full history unchanged so the conversation still works.
 *  - The summary is background context, NOT authoritative clinical data. The prompt tells
 *    the model to re-fetch exact values (labs/meds/vitals/doses) via tools.
 *  - Checkpoint persisted on chat_sessions.context.compaction (no chat_messages marker row,
 *    to avoid ordering/duplication with the frontend's own message persistence). The GUI
 *    renders the marker from this checkpoint + the live SSE `compacted` event.
 *
 * Env knobs:
 *  - COMPACTION_ENABLED            (default 'true'; set 'false' to disable)
 *  - COMPACTION_TRIGGER_TOKENS     (default 150000) fold when summary+tail exceeds this
 *  - COMPACTION_KEEP_RECENT_MESSAGES (default 30) verbatim tail kept after a fold
 *  - COMPACTION_MODEL              (default 'claude-sonnet-5')
 *  - COMPACTION_MAX_OUTPUT_TOKENS  (default 3000) summary length cap
 *  - COMPACTION_TIMEOUT_MS         (default 45000) skip compaction if the LLM call is slow
 */

const Anthropic = require('@anthropic-ai/sdk');

const SESSIONS_COLLECTION = 'chat_sessions';

// ---- config -------------------------------------------------------------
const cfg = () => ({
  enabled: (process.env.COMPACTION_ENABLED || 'true').toLowerCase() !== 'false',
  triggerTokens: parseInt(process.env.COMPACTION_TRIGGER_TOKENS, 10) || 150000,
  keepRecent: parseInt(process.env.COMPACTION_KEEP_RECENT_MESSAGES, 10) || 30,
  model: process.env.COMPACTION_MODEL || 'claude-sonnet-5',
  maxOutputTokens: parseInt(process.env.COMPACTION_MAX_OUTPUT_TOKENS, 10) || 3000,
  timeoutMs: parseInt(process.env.COMPACTION_TIMEOUT_MS, 10) || 45000,
});

// ---- Anthropic client (lazy, cached) ------------------------------------
let _client = null;
async function getClient() {
  if (_client) return _client;
  const productionKMS = require('./productionKMS');
  if (!productionKMS.initialized) await productionKMS.initialize();
  const apiKey = await productionKMS.getInternalKey('CLAUDE_API_KEY')
    || await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('No Claude/Anthropic API key in KMS for compaction');
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---- helpers ------------------------------------------------------------
const asText = (content) => (typeof content === 'string' ? content : JSON.stringify(content ?? ''));
const estTokens = (str) => Math.ceil((str || '').length / 4);
const roleLabel = (type) => (type === 'user' ? 'Doctor' : 'Assistant');

/** Only real conversational turns participate in compaction/history. */
function conversationalOnly(messages) {
  return (messages || []).filter((m) => m && (m.type === 'user' || m.type === 'agent'));
}

/**
 * Build the transcript text for the messages being folded into the summary.
 * Each message is bounded so one huge tool-result dump can't blow up the input.
 */
function buildFoldTranscript(messages) {
  const PER_MSG_CHAR_CAP = 8000;
  return messages
    .map((m) => {
      let t = asText(m.content).trim();
      if (t.length > PER_MSG_CHAR_CAP) t = t.slice(0, PER_MSG_CHAR_CAP) + ' …[truncated]';
      return `${roleLabel(m.type)}: ${t}`;
    })
    .join('\n\n');
}

const SUMMARY_SYSTEM_PROMPT = `You are compacting a medical assistant conversation between a DOCTOR (user) and an AI clinical assistant, to preserve continuity while saving context-window space.

You will receive a PRIOR SUMMARY (may be empty) and NEW MESSAGES to fold in. Produce ONE updated, consolidated summary that MERGES them.

Preserve, concisely and factually:
• Patient(s) discussed, including patient IDs / MRNs exactly as they appear.
• Active clinical problems, concerns and questions the doctor raised.
• Medications, labs, orders, imaging and results DISCUSSED, and any clinical decisions or plans made.
• Follow-ups, pending items, and unresolved questions.
• Doctor preferences or instructions about how to respond.

Hard rules:
• Do NOT invent, infer, or "fill in" any value. Include ONLY what actually appears in the text.
• Preserve exact identifiers, numbers and units verbatim; if a value was not stated, do not state it.
• This is a SUMMARY for continuity, not a medical record. Prefer brevity; drop pleasantries and redundant restatements.
• Output plain text with short sections/bullets. No preamble, no meta-commentary — just the summary.`;

/**
 * Run the summarization LLM call with a hard timeout. Returns the summary string,
 * or throws (caller falls back to prior summary).
 */
async function summarize(priorSummary, foldMessages, conf) {
  const client = await getClient();
  const transcript = buildFoldTranscript(foldMessages);
  const userContent =
    `PRIOR SUMMARY (already covers earlier turns; may be empty):\n` +
    `"""\n${(priorSummary || '(none)')}\n"""\n\n` +
    `NEW MESSAGES to fold into the summary (chronological):\n` +
    `"""\n${transcript}\n"""\n\n` +
    `Return the updated consolidated summary.`;

  const call = client.messages.create({
    model: conf.model,
    max_tokens: conf.maxOutputTokens,
    system: SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`compaction summary timed out after ${conf.timeoutMs}ms`)), conf.timeoutMs)
  );

  const resp = await Promise.race([call, timeout]);
  const text = (resp?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('compaction summary returned empty text');
  return text;
}

async function loadCheckpoint(sessionId, secureContext) {
  const SecureDataAccess = require('./secureDataAccess');
  const sessions = await SecureDataAccess.query(
    SESSIONS_COLLECTION,
    { sessionId },
    { limit: 1 },
    secureContext
  );
  return sessions && sessions.length > 0 ? (sessions[0].context?.compaction || null) : null;
}

async function saveCheckpoint(sessionId, checkpoint, secureContext) {
  const SecureDataAccess = require('./secureDataAccess');
  await SecureDataAccess.update(
    SESSIONS_COLLECTION,
    { sessionId },
    { $set: { 'context.compaction': checkpoint } },
    secureContext
  );
}

/**
 * Prepare conversation history for a chat request: fold older turns into a rolling
 * summary when the threshold is crossed, and return the verbatim recent tail.
 *
 * @param {object}   p
 * @param {string}   p.sessionId
 * @param {Array}    p.messages     - ALL decrypted session messages (chronological; each {type, content, _id, ...})
 * @param {object}   p.secureContext
 * @param {string}   [p.practiceId]
 * @param {function} [p.onEvent]    - optional SSE emitter for live `compacted` events
 * @param {boolean}  [p.force]      - manual "Compact now": bypass the token threshold
 * @returns {Promise<{summaryText: string, tailMessages: Array, compacted: boolean}>}
 */
async function prepareHistory({ sessionId, messages, secureContext, practiceId, onEvent, force = false } = {}) {
  const conf = cfg();
  const conv = conversationalOnly(messages);

  // Disabled or nothing to do → pass through unchanged.
  if (!conf.enabled || !sessionId || conv.length === 0) {
    return { summaryText: '', tailMessages: conv, compacted: false };
  }

  let checkpoint = null;
  try {
    checkpoint = await loadCheckpoint(sessionId, secureContext);
  } catch (e) {
    console.warn(`[Compaction] Could not load checkpoint (${e.message}); treating as none.`);
  }

  let summary = checkpoint?.summary || '';
  let priorCovered = checkpoint?.messageCountCovered || 0;

  // Determine the verbatim tail: everything AFTER the last-covered message.
  let startIdx = 0;
  if (checkpoint?.coversToId) {
    const idx = conv.findIndex((m) => String(m._id) === String(checkpoint.coversToId));
    if (idx >= 0) {
      startIdx = idx + 1;
    } else {
      // The previously-covered anchor is gone (message edited/deleted). Rebuild cleanly so we
      // don't feed the same turns to the model both summarized AND verbatim (and don't double-count).
      summary = '';
      priorCovered = 0;
    }
  }
  let tail = conv.slice(startIdx);

  const summaryTokens = estTokens(summary);
  const tailTokens = tail.reduce((a, m) => a + estTokens(asText(m.content)), 0);
  const totalTokens = summaryTokens + tailTokens;

  const shouldCompact =
    (force || totalTokens > conf.triggerTokens) && tail.length > conf.keepRecent;

  if (!shouldCompact) {
    return { summaryText: summary, tailMessages: tail, compacted: false };
  }

  // Fold everything except the most-recent `keepRecent` messages.
  const foldMessages = tail.slice(0, tail.length - conf.keepRecent);
  const keepMessages = tail.slice(tail.length - conf.keepRecent);
  const lastFolded = foldMessages[foldMessages.length - 1];

  // Tell the client compaction is starting so it can show a live progress card until 'compacted'.
  if (typeof onEvent === 'function') {
    try { onEvent({ type: 'compaction_start', foldingCount: foldMessages.length }); } catch (_) { /* never break compaction on a stream hiccup */ }
  }

  let newSummary;
  try {
    newSummary = await summarize(summary, foldMessages, conf);
  } catch (e) {
    // Fail-safe: never break the chat. Skip compaction this turn, keep full tail.
    console.error(`[Compaction] Summarization failed (${e.message}); skipping compaction this turn.`);
    return { summaryText: summary, tailMessages: tail, compacted: false };
  }

  const newCheckpoint = {
    summary: newSummary,
    coversToId: (lastFolded && lastFolded._id) ? String(lastFolded._id) : (checkpoint?.coversToId || null),
    coversToCreatedAt: lastFolded?.createdAt || null,
    messageCountCovered: priorCovered + foldMessages.length,
    tokenEstimate: estTokens(newSummary),
    model: conf.model,
    updatedAt: new Date(),
    version: 1,
  };

  try {
    await saveCheckpoint(sessionId, newCheckpoint, secureContext);
  } catch (e) {
    // If we can't persist, still USE the fresh summary for THIS request (better recall now);
    // it will simply be recomputed next turn.
    console.error(`[Compaction] Failed to persist checkpoint (${e.message}); using summary for this turn only.`);
  }

  const foldedCount = foldMessages.length;
  const keptCount = keepMessages.length;
  console.log(`🗜️  [Compaction] Folded ${foldedCount} older messages into summary (~${estTokens(newSummary)} tok); kept ${keptCount} verbatim. Session ${sessionId}.`);

  if (typeof onEvent === 'function') {
    try {
      onEvent({
        type: 'compacted',
        foldedCount,
        keptCount,
        totalCovered: newCheckpoint.messageCountCovered,
        at: newCheckpoint.updatedAt,
        summaryPreview: newSummary.slice(0, 240),
      });
    } catch (_) { /* never let a stream hiccup break compaction */ }
  }

  return { summaryText: newSummary, tailMessages: keepMessages, compacted: true };
}

/**
 * Manual "Compact now": load the session's messages and force a fold.
 * Returns a small status object for the endpoint/GUI.
 */
async function compactNow({ sessionId, secureContext, practiceId, onEvent } = {}) {
  const SecureDataAccess = require('./secureDataAccess');
  const encryptionService = require('./encryptionService');

  const dbMessages = await SecureDataAccess.query(
    'chat_messages',
    { sessionId },
    { sort: { _id: 1 } },
    secureContext
  );
  const decrypted = await Promise.all((dbMessages || []).map(async (msg) => {
    try {
      if (msg.content && typeof msg.content === 'object' && (msg.content.encrypted || msg.content.iv)) {
        return { ...msg, content: await encryptionService.decrypt(msg.content) };
      }
    } catch (_) { /* keep as-is on decrypt failure */ }
    return msg;
  }));

  const result = await prepareHistory({
    sessionId, messages: decrypted, secureContext, practiceId, onEvent, force: true,
  });
  return {
    compacted: result.compacted,
    keptMessages: result.tailMessages.length,
    summaryTokensEstimate: estTokens(result.summaryText),
  };
}

module.exports = { prepareHistory, compactNow };
