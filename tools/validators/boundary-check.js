#!/usr/bin/env node

/**
 * Module Boundary Check Script
 * Validates module boundaries according to Nx configuration
 */

const fs = require('fs');
const path = require('path');

function validateModuleBoundaries() {
    console.log('🔍 Validating module boundaries...\n');
    
    try {
        // Read nx.json for project tags
        const nxConfigPath = path.join(__dirname, '..', '..', 'nx.json');
        const nxConfig = JSON.parse(fs.readFileSync(nxConfigPath, 'utf8'));
        
        // Read ESLint config for boundary rules
        const eslintConfigPath = path.join(__dirname, '..', '..', '.eslintrc.json');
        const eslintConfig = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
        
        console.log('📋 Project Tags:');
        Object.keys(nxConfig.projects).forEach(project => {
            const tags = nxConfig.projects[project].tags || [];
            console.log(`  ${project}: ${tags.join(', ')}`);
        });
        
        console.log('\n🛡️ Dependency Constraints:');
        const depConstraints = eslintConfig.rules['@nrwl/nx/enforce-module-boundaries'][1].depConstraints;
        
        depConstraints.forEach(constraint => {
            const sourceTag = constraint.sourceTag;
            const allowedTags = constraint.onlyDependOnLibsWithTags;
            
            console.log(`  ${sourceTag} → can depend on: ${allowedTags.join(', ')}`);
        });
        
        console.log('\n✅ Module boundary configuration loaded successfully!');
        console.log('💡 Use "nx lint" to check actual boundary violations in code.');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error validating module boundaries:', error.message);
        return false;
    }
}

// Function to check if there are any boundary violations
function checkBoundaryViolations() {
    console.log('\n🔍 Checking for potential boundary violations...');
    
    // This would typically use Nx graph analysis
    // For now, we'll just validate the configuration is correct
    console.log('⚠️  To check actual violations, run: nx lint');
    console.log('⚠️  To visualize dependencies, run: nx graph');
}

// Run validation if called directly
if (require.main === module) {
    const isValid = validateModuleBoundaries();
    checkBoundaryViolations();
    process.exit(isValid ? 0 : 1);
}

module.exports = { validateModuleBoundaries, checkBoundaryViolations };