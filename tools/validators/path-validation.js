#!/usr/bin/env node

/**
 * Path Validation Script
 * Validates all TypeScript/JavaScript path mappings defined in tsconfig.base.json
 */

const fs = require('fs');
const path = require('path');

function validatePathMappings() {
    console.log('🔍 Validating path mappings...\n');
    
    try {
        // Read tsconfig.base.json
        const tsconfigPath = path.join(__dirname, '..', '..', 'tsconfig.base.json');
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        
        const paths = tsconfig.compilerOptions.paths;
        let allValid = true;
        
        Object.keys(paths).forEach(alias => {
            const mappedPaths = paths[alias];
            
            console.log(`📦 Checking alias: ${alias}`);
            
            mappedPaths.forEach(mappedPath => {
                const fullPath = path.join(__dirname, '..', '..', mappedPath);
                const dirPath = path.dirname(fullPath);
                
                if (fs.existsSync(dirPath)) {
                    console.log(`  ✅ Directory exists: ${dirPath}`);
                } else {
                    console.log(`  ❌ Directory missing: ${dirPath}`);
                    allValid = false;
                }
                
                // Check if index.js exists or can be created
                if (fs.existsSync(fullPath)) {
                    console.log(`  ✅ Index file exists: ${fullPath}`);
                } else {
                    console.log(`  ⚠️  Index file missing: ${fullPath} (will be created when lib is implemented)`);
                }
            });
            
            console.log('');
        });
        
        if (allValid) {
            console.log('🎉 All path mappings are valid!');
            return true;
        } else {
            console.log('❌ Some path mappings have issues. Please check the output above.');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error validating path mappings:', error.message);
        return false;
    }
}

// Run validation if called directly
if (require.main === module) {
    const isValid = validatePathMappings();
    process.exit(isValid ? 0 : 1);
}

module.exports = validatePathMappings;