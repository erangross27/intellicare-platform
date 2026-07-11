# CSV Import Caching - 4 Block Limit Solution

## The Problem
Claude API has a **maximum of 4 blocks with cache_control** per request. Exceeding this limit causes:
```
400 {"type":"error","error":{"type":"invalid_request_error","message":"A maximum of 4 blocks with cache_control may be provided. Found 5."}}
```

## The Solution

### For CSV Imports (when `importPatientsFromCSV` is selected):

**Cache Blocks Used: 2 of 4**
1. **System + CSV Instructions** (combined in one block) ✅
2. **First Tool Only** (`importPatientsFromCSV`) ✅
3. ~~Tool Definitions~~ (NOT cached for CSV)
4. ~~Message Content~~ (NOT cached for CSV)

### For Regular Operations:

**Cache Blocks Used: Up to 4**
1. **System Prompt** ✅
2. **Tool Definitions** ✅
3. **First 3 Tools** ✅ (up to 3 blocks)

## Implementation Details

### CSV Import Detection
The system detects CSV imports when the embedding server selects:
- `importPatientsFromCSV`
- `importUsersFromCSV`

### Cache Strategy for CSV
```javascript
// ONE combined cached block for system + CSV instructions
const combinedSystemMessage = systemPrompt + '\n\n' + csvInstructions;
systemBlocks.push({
  type: 'text',
  text: combinedSystemMessage,
  cache_control: { type: 'ephemeral' }
});

// Only cache the FIRST tool
if (index === 0) {
  return { ...tool, cache_control: { type: 'ephemeral' } };
}
```

## Benefits
- **Stays within 4 block limit** ✅
- **Caches critical CSV instructions** (1,600+ tokens)
- **Caches the main import function**
- **Reusable for 5 minutes** across all 3 API calls

## Monitoring
Look for these in console:
```
📊 CSV Import Function Detected - Adding comprehensive cached instructions
🔧 [Claude Agent] CSV Import: Limited to 1 cached tool to avoid exceeding 4 block limit
```

## Token Savings
- First import: ~1,600 tokens written to cache
- Subsequent imports: ~1,600 tokens read from cache
- Savings: ~20% reduction in token usage