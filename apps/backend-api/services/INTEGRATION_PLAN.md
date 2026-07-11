# Tool Use Pattern Integration - Full Replacement

## Status: READY TO IMPLEMENT

## Current State
- ✅ ClaudeBatchProcessorToolUse.js created and tested
- ✅ Import added to claudeBatchProcessor.js (line 12)
- ✅ toolUseHelper initialized in constructor (line 28)
- ✅ Existing tool use at line 382-383

## Current Approach (Line 382)
```javascript
tools: [this.getDocumentAnalysisTools()],
tool_choice: { type: 'tool', name: 'extract_medical_data' }
```

Returns ONE giant tool `extract_medical_data` with ALL 758 collections

## New Approach - Collection-Specific Tools

### Step 1: Add New Method (after line 2700)
```javascript
/**
 * Build collection-specific extraction tools from unified schemas
 * Uses Tool Use pattern for 80%+ schema compliance
 *
 * @param {Array<string>} collectionNames - Collections to extract (detected from document)
 * @returns {Array} Array of Anthropic tool schemas, one per collection
 */
buildCollectionExtractionTools(collectionNames) {
  const tools = [];

  // Build one tool per collection using unified schemas
  for (const collectionName of collectionNames) {
    try {
      const tool = this.toolUseHelper.buildExtractionTool(collectionName);
      tools.push(tool);
    } catch (error) {
      console.warn(`⚠️  Failed to build tool for ${collectionName}:`, error.message);
    }
  }

  console.log(`🔧 Built ${tools.length} collection-specific extraction tools`);
  return tools;
}
```

### Step 2: Update Batch Request Building (line 382)
```javascript
// OLD:
tools: [this.getDocumentAnalysisTools()],
tool_choice: { type: 'tool', name: 'extract_medical_data' }

// NEW:
tools: this.buildCollectionExtractionTools(['outcomes_prediction', 'medications', ...]),
// No tool_choice - let Claude pick which collections are relevant
// OR force first tool: tool_choice: { type: 'tool', name: tools[0].name }
```

## Decision Points

### Q1: Which collections to build tools for?
**Option A:** Build tools for ALL 758 collections (slow, expensive)
**Option B:** Detect likely collections from document text FIRST, then build tools
**Option C:** Let user specify collections when creating batch

**RECOMMENDATION: Option B** - Add collection detection step

### Q2: Tool choice parameter?
**Option A:** No tool_choice - let Claude pick relevant collections
**Option B:** Force first tool - tool_choice for primary collection
**Option C:** Multiple tool_choice calls (not supported)

**RECOMMENDATION: Option A** - Claude picks which tools to use

### Q3: Keep getDocumentAnalysisTools()?
**Option A:** Delete completely (full replacement)
**Option B:** Keep as fallback
**Option C:** Rename to _deprecated_getDocumentAnalysisTools

**RECOMMENDATION: Option B** - Keep as fallback for testing

## Implementation Order
1. ✅ Add buildCollectionExtractionTools() method
2. ✅ Add collection detection logic (analyze document text)
3. ✅ Update line 382 to use new method
4. ⏳ Test with sample document
5. ⏳ Verify schema enforcement
6. ⏳ Commit changes

## Testing Plan
1. Process ONE document with known collections (e.g., contains outcomes_prediction)
2. Verify tools are built correctly
3. Verify Claude uses correct field names
4. Compare output quality vs old approach

## Rollback Plan
If tool use approach fails:
1. Revert line 382 to use getDocumentAnalysisTools()
2. Keep new methods for future use
3. No data loss - same extraction logic

## Next Action
USER APPROVAL NEEDED:
- Proceed with Option B (detect collections from document)?
- Or specify collections manually?
