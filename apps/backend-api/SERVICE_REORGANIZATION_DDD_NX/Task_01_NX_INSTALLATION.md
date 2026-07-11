# Task 01: Install and Configure Nx Monorepo

## Objective
Install Nx CLI and initialize the monorepo structure for IntelliCare platform

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Git repository initialized
- Full backup of current codebase

## Implementation Steps

### 1. Install Nx CLI Globally
```bash
npm install -g nx@latest
```

### 2. Initialize Nx Workspace
```bash
# In the root directory (NOT in backend/)
npx create-nx-workspace@latest --preset=empty --packageManager=npm
```

### 3. Configure Nx for Existing Project
- DO NOT create new workspace
- Add Nx to existing project structure
- Preserve current folder organization

### 4. Create nx.json Configuration
```json
{
  "npmScope": "intellicare",
  "affected": {
    "defaultBase": "main"
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test", "lint"],
        "parallel": 3
      }
    }
  }
}
```

### 5. Update Root package.json
Add Nx dependencies:
- @nrwl/workspace
- @nrwl/node
- @nrwl/js
- @nrwl/devkit

### 6. Create workspace.json
Initial workspace configuration with existing projects

### 7. Verify Installation
```bash
nx --version
nx list
```

## Expected Outcomes
- ✅ Nx CLI installed and accessible
- ✅ nx.json created in root directory
- ✅ workspace.json configured
- ✅ Package.json updated with Nx dependencies
- ✅ Existing code structure preserved

## Validation Steps
1. Run `nx --version` - should show version
2. Run `nx list` - should show available plugins
3. Check nx.json exists and is valid JSON
4. Verify no existing code was modified

## Rollback Plan
1. Remove nx.json and workspace.json
2. Revert package.json changes
3. Uninstall Nx CLI globally
4. Delete node_modules and reinstall

## Time Estimate
- Implementation: 30 minutes
- Testing: 15 minutes
- Documentation: 10 minutes

## Dependencies
- None (first task)

## Next Task
Task_02_WORKSPACE_STRUCTURE.md

## Notes for Agent
- DO NOT create new workspace from scratch
- PRESERVE all existing code
- Only add Nx configuration files
- Keep backend/ and frontend-vite/ in place