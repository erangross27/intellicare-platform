/**
 * BATCH COST CIRCUIT BREAKER
 *
 * Added June 11, 2026 after a misconfigured batch burned $38 in a single
 * submission. Estimates the input cost of a batch from its request payload
 * size BEFORE submitting to Anthropic and THROWS if the estimate exceeds
 * BATCH_MAX_COST_USD (default $10).
 *
 * This guard is intentionally simple and conservative. If a legitimate run
 * needs a bigger budget, raise BATCH_MAX_COST_USD in the backend .env
 * deliberately - NEVER delete or bypass the guard itself.
 */

const CHARS_PER_TOKEN = 3.5;        // conservative chars-per-token for English/JSON
const INPUT_PRICE_PER_MTOK = 2.5;   // Opus batch input price (50% batch discount)

function assertBatchCostWithinBudget(requests, label = 'batch') {
  const totalChars = requests.reduce((sum, r) => sum + JSON.stringify(r.params || r).length, 0);
  const estTokens = Math.round(totalChars / CHARS_PER_TOKEN);
  const estCost = (estTokens / 1e6) * INPUT_PRICE_PER_MTOK;
  const cap = parseFloat(process.env.BATCH_MAX_COST_USD || '10');

  console.log(`🛡️ Cost guard [${label}]: ${requests.length} request(s), ~${estTokens.toLocaleString()} input tokens ≈ $${estCost.toFixed(2)} (cap $${cap.toFixed(2)})`);

  if (estCost > cap) {
    throw new Error(
      `🛡️ BATCH BLOCKED by cost circuit breaker [${label}]: estimated input cost ` +
      `$${estCost.toFixed(2)} exceeds BATCH_MAX_COST_USD=$${cap.toFixed(2)} ` +
      `(${requests.length} requests, ~${estTokens.toLocaleString()} tokens). ` +
      `If this is intentional, raise BATCH_MAX_COST_USD in the backend .env.`
    );
  }

  return estCost;
}

module.exports = { assertBatchCostWithinBudget };
