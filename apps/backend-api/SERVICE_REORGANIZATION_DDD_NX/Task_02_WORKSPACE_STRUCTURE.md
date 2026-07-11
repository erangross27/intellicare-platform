# Task 02: Create Workspace Structure

## Objective
Set up the base Nx workspace structure with apps and libs folders

## Prerequisites
- Task_01 completed (Nx installed)
- nx.json exists
- workspace.json exists

## Implementation Steps

### 1. Create Base Directories
```
intellicare/
├── apps/           # Create this
├── libs/           # Create this
├── tools/          # Create this
├── backend/        # Keep existing
├── frontend-vite/  # Keep existing
```

### 2. Configure Apps Directory
Create symbolic links or references:
- apps/backend-api → ../backend
- apps/frontend-vite → ../frontend-vite
- apps/admin-portal → (future placeholder)

### 3. Create Libs Directory Structure
```
libs/
├── patient-management/
├── clinical-care/
├── medical-records/
├── billing-insurance/
├── compliance-security/
├── communication/
├── ai-analytics/
├── infrastructure/
├── integration/
├── learning-training/
├── operations/
└── shared/
```

### 4. Create Tools Directory
```
tools/
├── migrations/
├── generators/
├── scripts/
└── validators/
```

### 5. Update workspace.json
Add project configurations for each bounded context

### 6. Create .gitkeep Files
Add .gitkeep in each empty directory to preserve structure

## Expected Outcomes
- ✅ apps/ directory created with links
- ✅ libs/ directory with 12 subdirectories
- ✅ tools/ directory with utilities
- ✅ Existing code untouched
- ✅ Git tracking new structure

## Validation Steps
1. Run `ls -la apps/` - verify links
2. Run `ls -la libs/` - verify 12 directories
3. Check workspace.json has project entries
4. Verify backend/ and frontend-vite/ unchanged

## Rollback Plan
1. Delete apps/ directory
2. Delete libs/ directory
3. Delete tools/ directory
4. Revert workspace.json

## Time Estimate
- Implementation: 20 minutes
- Testing: 10 minutes
- Documentation: 5 minutes

## Dependencies
- Task_01 (Nx installation)

## Next Task
Task_03_TYPESCRIPT_CONFIG.md

## Notes for Agent
- Use symbolic links for apps/ to avoid moving code
- Create empty directories with .gitkeep
- DO NOT move any services yet
- Focus only on directory structure