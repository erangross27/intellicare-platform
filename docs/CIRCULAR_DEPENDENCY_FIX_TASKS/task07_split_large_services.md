# Task 07: Split Large Services

## Objective
Break large services into smaller modules

## Services to Split
1. `agentServiceV4.js` (12000+ lines)
   - Core functions
   - Medical functions
   - Admin functions
   - Analytics functions

2. `agentServiceWrapper.js`
   - Router logic
   - Workflow detection
   - Context management

## Success Criteria
- Smaller, focused service files
- Clear separation of concerns
- Easier to maintain