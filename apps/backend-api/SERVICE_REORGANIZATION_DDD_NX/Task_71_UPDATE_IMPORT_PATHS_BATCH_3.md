# Task 71: Update Import Paths Batch 3

## Objective
Update all import paths for 178 services in Batch 3 to use Nx workspace structure

## Prerequisites
- Task_70 completed (testing done)
- All 178 services migrated
- Nx workspace structure ready

## Implementation Steps

### 1. Import Path Mapping
Create mapping for all 178 services:
- Old path → New @intellicare/* path
- Integration services paths
- Learning services paths
- Operations services paths
- Shared services paths

### 2. Update Service Imports
Change all require/import statements:
- From relative paths
- To Nx workspace paths
- Maintain functionality
- Update TypeScript paths

### 3. Update Cross-References
Fix all cross-service references:
- Service dependencies
- Shared utilities
- Common interfaces
- Type definitions

### 4. Fix Circular Dependencies
Ensure no new circular dependencies:
- Check dependency graph
- Use ServiceProxyManager
- Lazy loading where needed
- Validate loading order

### 5. Update Test Imports
Fix all test file imports:
- Unit test imports
- Integration test imports
- Mock imports
- Test utilities

### 6. Update Configuration
Update configuration files:
- tsconfig.json paths
- Module resolution
- Build configuration
- Bundle configuration

### 7. Validate All Imports
Verify imports resolve correctly:
- No missing modules
- No duplicate imports
- Correct versions
- Type checking passes

### 8. Update Documentation
Document import changes:
- Import conventions
- Path mappings
- Migration guide
- Troubleshooting

### 9. Test Import Resolution
Test that everything resolves:
- Build succeeds
- Tests pass
- No runtime errors
- IDE recognition

### 10. Create Import Map
Document final import structure:
- Complete mapping
- Naming conventions
- Best practices
- Common patterns

## Expected Outcomes
- ✅ All 178 services updated
- ✅ Import paths correct
- ✅ No circular dependencies
- ✅ Tests passing
- ✅ Documentation complete

## Validation Steps
1. Build succeeds
2. All imports resolve
3. Tests pass
4. No circular dependencies
5. IDE auto-complete works

## Time Estimate
- Implementation: 6 hours
- Testing: 3 hours
- Documentation: 1 hour

## Dependencies
- Task_70 (Batch 3 testing)

## Next Task
Task_72_ADD_AUTHENTICATION_BATCH_3.md

## Notes for Agent
- Update ALL imports
- Check for circular deps
- Test thoroughly
- Document mappings
- Verify IDE support