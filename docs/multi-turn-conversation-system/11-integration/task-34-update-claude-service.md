# Task 34: Update Claude Service Integration

## Objective
Modify agentServiceClaude to use the enhanced conversation system

## Current Implementation Location
- File: `services/agentServiceClaude.js`
- Method: `getCoreFunctions()`
- Lines: 3427-3511

## Required Changes
1. Import enhancedConversationSystem at top of file
2. Initialize enhanced system if not initialized
3. Replace mode detection logic with enhanced system call
4. Map enhanced results to expected format
5. Preserve existing fallback logic

## Key Improvements
- NLP tokens will be used for better matching
- Pronouns will be resolved before processing
- Context will be maintained across turns
- Learning system will track patterns

## Backward Compatibility
- Keep same method signature
- Return same data structure
- Maintain fallback to intent-based analysis
- Preserve error handling

## Success Criteria
- [ ] Enhanced system imported
- [ ] Mode detection uses NLP
- [ ] Coreference resolution active
- [ ] Function bundles still load correctly
- [ ] No API breaking changes