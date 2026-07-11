// Sanitize Anthropic summarized-thinking blocks before they are streamed to the chat UI.
//
// On Opus 4.8 / Fable 5 the raw chain of thought is never returned; the only way to surface
// any reasoning to the user is thinking:{ type:'adaptive', display:'summarized' }, which runs
// the model's reasoning through Anthropic's server-side SUMMARIZER. That summarizer
// occasionally leaks its OWN meta-reasoning instead of a clean summary - most often when the
// underlying thinking chunk is trivial/empty. Observed leak (shown verbatim to a user):
//
//   "I notice the next thinking only contains 'Let me summarize.' which is a meta-commentary
//    phrase that breaks the illusion of natural thinking ... the guidelines state to produce
//    an empty response if the next_thinking is ... whitespace-only ... I should output nothing."
//
// We forward summarized-thinking blocks verbatim to the frontend as the live "thinking
// process". This guard drops summarizer meta-commentary and degenerate blocks BEFORE display,
// so the leak never reaches the user while genuine summarized reasoning still shows.
//
// IMPORTANT: apply this ONLY to raw model thinking. The hand-written status strings
// ("🔍 Searching...", getThinkingMessage(), the bilingual ✓/⚙️/Error lines) are trusted and
// must NOT be filtered through this guard.

// Phrases distinctive to the summarizer talking ABOUT its own guidelines, rather than
// summarizing the model's reasoning. Kept deliberately narrow: a clinical summary may
// legitimately mention "the guidelines" (e.g. ADA / clinical guidelines), so that generic
// phrase is intentionally NOT treated as a tell.
const SUMMARIZER_META = /next[\s_-]?thinking|meta-?commentary|meta-?instruction|breaks? the illusion|illusion of (?:natural )?thinking|whitespace-only|i should output nothing|produce an empty response/i;

/**
 * Whether a summarized-thinking block is safe to show the user.
 * @param {string} text - accumulated thinking-block content
 * @returns {boolean} true → display it; false → drop it (meta-leak or degenerate fragment)
 */
function isDisplayableThinking(text) {
  if (!text) return false;
  const t = String(text).trim();
  if (t.length < 8) return false;             // empty / degenerate fragment
  if (/^let me summarize\.?$/i.test(t)) return false;
  if (SUMMARIZER_META.test(t)) return false;  // summarizer meta-commentary leak
  return true;
}

module.exports = { isDisplayableThinking };
