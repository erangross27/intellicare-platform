# Task 04: Fix Agent Service Wrapper

## Objective
Remove direct requires that cause circular deps

## File to Fix
`backend/services/agentServiceWrapper.js`

## Changes
1. Remove top-level requires for learning services
2. Use lazy loading functions
3. Ensure services are accessed after initialization

## Pattern
```javascript
// Instead of: const service = require('./service');
let service = null;
function getService() {
  if (!service) service = require('./service');
  return service;
}
```

## Success Criteria
- No circular dependencies from wrapper
- Services load correctly when needed