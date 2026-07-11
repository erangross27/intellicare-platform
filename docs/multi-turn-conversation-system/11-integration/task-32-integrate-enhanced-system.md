# Task 32: Integrate Enhanced Conversation System

## Objective
Replace basic mode detection with enhanced system that includes NLP and coreference

## Current State
- Using: `conversationModeManager` directly in agentServiceClaude
- Should use: `enhancedConversationSystem` which wraps all features

## Integration Points
1. In `agentServiceClaude.getCoreFunctions()` method
2. Replace lines 3433-3511 with enhanced system call
3. Update session management to use enhanced version

## Steps
1. Import enhancedConversationSystem
2. Replace mode detection logic
3. Use processMessage() method instead of direct detection
4. Map enhanced results to existing return format
5. Preserve backward compatibility

## Benefits
- Adds NLP processing automatically
- Enables pronoun resolution
- Improves context tracking
- Better entity extraction

## Success Criteria
- [ ] Enhanced system integrated
- [ ] NLP processing active
- [ ] Coreference resolution working
- [ ] No breaking changes to API