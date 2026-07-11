# Two-Stage Function Selection Proposal

## Current Problem
The semantic search is failing to select `getPatientDetails` for queries like "give me more details on William Young" - it's selecting research consent forms and other unrelated functions instead.

## Proposed Solution: Two-Stage Claude API Approach

### Stage 1: Function Selection (Claude as the selector)
Send Claude just the function names and let it pick the right one(s):

```javascript
// First API call - Function Selection
const functionNames = [
  "acknowledgePolicy",
  "addAllergy",
  "addPatient",
  "getPatientDetails",  // <- Claude would correctly identify this
  "getPatientHistory",
  "viewPatientDetails",
  // ... 1,413 total functions
];

const stage1Prompt = {
  system: "You are a function selector. Given a user query, return only the function names that should be called.",
  user: "User query: give me more details on William Young",
  functions: functionNames  // Just names, no parameters
};

// Claude response: ["getPatientDetails"]
```

### Stage 2: Function Execution
```javascript
// Second API call - Execute with full function definition
const selectedFunction = {
  name: "getPatientDetails",
  description: "Get comprehensive patient details",
  parameters: {
    patientId: { type: "string", description: "Patient ID" },
    includeHistory: { type: "boolean", description: "Include medical history" }
    // ... full parameter schema
  }
};

// Claude executes the function correctly
```

## Analysis

### Function List Size
- **Total functions**: 1,413
- **Names only**: ~8,798 tokens (35KB)
- **Names + descriptions**: ~31,245 tokens (125KB)
- **Full definitions**: ~60,996 tokens (244KB)

### Cost Comparison

| Approach | Tokens | Cost | Accuracy | Latency |
|----------|--------|------|----------|---------|
| **Current (Semantic Search)** | ~2,500 | $0.008 | 70-80% | 3s |
| **Two-Stage (Names Only)** | ~9,300 | $0.029 | 95-99% | 5-6s |
| **Two-Stage (Names + Desc)** | ~31,500 | $0.095 | 98-99% | 5-6s |

### Pros of Two-Stage Approach
1. **Near-perfect accuracy** - Claude understands context better than embeddings
2. **No training data needed** - Works immediately for new functions
3. **Handles complex queries** - "Show me all patients with diabetes who missed appointments"
4. **Natural language understanding** - Handles typos, synonyms, medical terms
5. **Self-improving** - Claude learns from context in conversation

### Cons of Two-Stage Approach
1. **3.6x more expensive** per request ($0.029 vs $0.008)
2. **2x slower** (two sequential API calls)
3. **More complex error handling** (two points of failure)
4. **Higher token usage** (9,000 vs 2,500 tokens)

## Hybrid Approach Recommendation

```javascript
async function selectFunctions(query, context) {
  // Try semantic search first (fast & cheap)
  const semanticResults = await semanticSearch.select(query, 10);

  // Calculate confidence based on scores
  const topScore = semanticResults[0]?.score || 0;
  const confidence = calculateConfidence(semanticResults);

  if (confidence > 0.8) {
    // High confidence - use semantic results
    return semanticResults;
  } else {
    // Low confidence - use two-stage Claude approach
    console.log('⚠️ Low confidence, using Claude for selection');

    // Stage 1: Send function names to Claude
    const selectedNames = await claude.selectFunctions(functionNames, query);

    // Stage 2: Return full function definitions
    return selectedNames.map(name => functionRegistry.get(name));
  }
}
```

## Specific Use Cases

### When to Use Two-Stage:
1. **Medical decisions** - "What medication should I prescribe?"
2. **Complex queries** - "Show all diabetic patients who missed appointments last month"
3. **Natural language** - "Tell me about William Young's condition"
4. **Multi-function needs** - "Schedule appointment and send reminder"

### When to Keep Single-Stage:
1. **Simple lookups** - "listAllPatients"
2. **Direct function calls** - "getPatientById"
3. **High-frequency operations** - Chat messages
4. **Non-critical queries** - UI updates

## Implementation Strategy

### Phase 1: Confidence-Based Hybrid
- Keep semantic search as primary
- Add confidence scoring
- Fall back to two-stage when confidence < 0.8

### Phase 2: Query Classification
- Classify queries by type (simple/complex)
- Route to appropriate strategy
- Cache Claude's selections for similar queries

### Phase 3: Learning System
- Track which approach works best for query patterns
- Build a routing model over time
- Optimize cost vs accuracy trade-off

## Monthly Cost Impact

Assuming 10,000 requests/day:
- **Current**: $0.008 × 10,000 = $80/day = $2,400/month
- **All Two-Stage**: $0.029 × 10,000 = $290/day = $8,700/month
- **Hybrid (20% two-stage)**: $112/day = $3,360/month

## Conclusion

The two-stage approach would provide **near-perfect accuracy** but at **3.6x the cost**.

**Recommendation**: Implement a hybrid approach that:
1. Uses semantic search for most queries (fast & cheap)
2. Falls back to two-stage for low-confidence or critical queries
3. Gradually learns which queries need two-stage

This balances cost, accuracy, and performance while fixing the current accuracy problems for complex queries like "give me more details on William Young".