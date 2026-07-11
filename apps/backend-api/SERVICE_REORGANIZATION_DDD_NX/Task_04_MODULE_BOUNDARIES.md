# Task 04: Configure Module Boundary Rules

## Objective
Set up Nx module boundary enforcement to prevent circular dependencies

## Prerequisites
- Task_03 completed (TypeScript configured)
- nx.json exists
- ESLint installed

## Implementation Steps

### 1. Install Nx ESLint Plugin
```bash
npm install --save-dev @nrwl/eslint-plugin-nx
```

### 2. Create .eslintrc.json in Root
```json
{
  "plugins": ["@nrwl/nx"],
  "rules": {
    "@nrwl/nx/enforce-module-boundaries": [
      "error",
      {
        "enforceBuildableLibDependency": true,
        "depConstraints": [
          // Define allowed dependencies between scopes
        ]
      }
    ]
  }
}
```

### 3. Define Scope Tags in nx.json
```json
{
  "projects": {
    "patient-management": {
      "tags": ["scope:patient", "type:feature"]
    },
    "clinical-care": {
      "tags": ["scope:clinical", "type:feature"]
    },
    // ... for all 12 bounded contexts
  }
}
```

### 4. Configure Dependency Constraints
Define which scopes can depend on which:
- patient → shared only
- clinical → patient, shared
- billing → patient, clinical, shared
- compliance → all (for auditing)
- shared → none (leaf nodes)

### 5. Create Boundary Validation Script
```javascript
// tools/validators/boundary-check.js
// Script to validate module boundaries
```

### 6. Add Pre-commit Hook
Enforce boundaries before commits

## Expected Outcomes
- ✅ ESLint plugin installed
- ✅ Module boundary rules defined
- ✅ Scope tags configured
- ✅ Dependency constraints set
- ✅ Validation script created

## Validation Steps
1. Run `nx lint` - check boundary rules
2. Try invalid import - should error
3. Check ESLint output
4. Verify pre-commit hook works

## Rollback Plan
1. Remove ESLint rule
2. Delete scope tags
3. Uninstall plugin
4. Remove validation script

## Time Estimate
- Implementation: 30 minutes
- Testing: 20 minutes
- Documentation: 10 minutes

## Dependencies
- Task_03 (TypeScript config)

## Next Task
Task_05_PATIENT_CONTEXT_SETUP.md

## Notes for Agent
- Start with permissive rules
- Tighten boundaries gradually
- Document each constraint reason
- Test with actual service imports