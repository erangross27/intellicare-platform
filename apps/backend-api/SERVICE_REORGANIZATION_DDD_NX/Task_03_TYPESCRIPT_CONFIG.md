# Task 03: Configure TypeScript for Monorepo

## Objective
Set up TypeScript configuration with path mappings for Nx monorepo

## Prerequisites
- Task_02 completed (workspace structure exists)
- libs/ directory structure created
- Existing TypeScript configs backed up

## Implementation Steps

### 1. Create tsconfig.base.json in Root
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@intellicare/patient-management": ["libs/patient-management/index.js"],
      "@intellicare/clinical-care": ["libs/clinical-care/index.js"],
      "@intellicare/medical-records": ["libs/medical-records/index.js"],
      "@intellicare/billing-insurance": ["libs/billing-insurance/index.js"],
      "@intellicare/compliance-security": ["libs/compliance-security/index.js"],
      "@intellicare/communication": ["libs/communication/index.js"],
      "@intellicare/ai-analytics": ["libs/ai-analytics/index.js"],
      "@intellicare/infrastructure": ["libs/infrastructure/index.js"],
      "@intellicare/integration": ["libs/integration/index.js"],
      "@intellicare/learning-training": ["libs/learning-training/index.js"],
      "@intellicare/operations": ["libs/operations/index.js"],
      "@intellicare/shared": ["libs/shared/index.js"]
    }
  }
}
```

### 2. Update Backend tsconfig.json
Extend from base configuration:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    // Keep existing backend-specific settings
  }
}
```

### 3. Update Frontend tsconfig.json
Extend from base configuration:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    // Keep existing frontend-specific settings
  }
}
```

### 4. Create jsconfig.json (for non-TS files)
Mirror path mappings for JavaScript files

### 5. Configure Module Resolution
Update Node.js module resolution to use paths

### 6. Add Path Validation Script
Create script to validate all path mappings

## Expected Outcomes
- ✅ tsconfig.base.json created with all paths
- ✅ Backend extends base config
- ✅ Frontend extends base config
- ✅ Path intellisense working in IDEs
- ✅ Module resolution configured

## Validation Steps
1. Check tsconfig.base.json valid JSON
2. Verify all 12 lib paths defined
3. Test path resolution in IDE
4. Run TypeScript compiler check

## Rollback Plan
1. Restore original tsconfig files
2. Delete tsconfig.base.json
3. Remove path mappings
4. Revert extends references

## Time Estimate
- Implementation: 25 minutes
- Testing: 15 minutes
- Documentation: 5 minutes

## Dependencies
- Task_02 (workspace structure)

## Next Task
Task_04_MODULE_BOUNDARIES.md

## Notes for Agent
- Keep all existing TypeScript settings
- Only add path mappings and extends
- Test with both .js and .ts files
- Ensure IDE support works