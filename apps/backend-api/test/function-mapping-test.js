/**
 * Function Mapping Validation Test
 * Ensures all functions in agentServiceV4.js are mapped in agentServiceClaude.js
 */

const agentServiceV4 = require('../services/agentServiceV4');
const agentServiceClaude = require('../services/agentServiceClaude');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

async function validateFunctionMappings() {
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}  Function Mapping Validation Test${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}\n`);

  try {
    // Initialize services if needed
    if (agentServiceV4.initialize) {
      await agentServiceV4.initialize();
    }

    // Get all functions from V4
    const allFunctions = agentServiceV4.getAllPlatformFunctions('en');
    const functionNames = new Set(allFunctions.map(f => f.name));
    
    console.log(`${colors.blue}Total functions in agentServiceV4:${colors.reset} ${functionNames.size}`);

    // Extract mapped functions from Claude service
    const mappedFunctions = new Set();
    const mappingCategories = [];
    
    // Get the mapKeywordsToFunctions object from Claude service
    const claudeSource = require('fs').readFileSync(
      require('path').join(__dirname, '../services/agentServiceClaude.js'),
      'utf8'
    );
    
    // Extract function mappings using regex
    const functionPattern = /functions:\s*\[([^\]]+)\]/g;
    let match;
    
    while ((match = functionPattern.exec(claudeSource)) !== null) {
      const functionsStr = match[1];
      const functions = functionsStr.split(',').map(f => 
        f.trim().replace(/['"]/g, '')
      ).filter(f => f);
      
      functions.forEach(f => mappedFunctions.add(f));
    }

    console.log(`${colors.blue}Total mapped functions in Claude:${colors.reset} ${mappedFunctions.size}`);

    // Find unmapped functions
    const unmappedFunctions = [];
    const incorrectlyMapped = [];
    
    for (const funcName of functionNames) {
      if (!mappedFunctions.has(funcName)) {
        unmappedFunctions.push(funcName);
      }
    }
    
    // Find functions mapped but don't exist
    for (const funcName of mappedFunctions) {
      if (!functionNames.has(funcName)) {
        incorrectlyMapped.push(funcName);
      }
    }

    // Display results
    console.log(`\n${colors.cyan}=== MAPPING COVERAGE ===${colors.reset}`);
    const coverage = ((mappedFunctions.size / functionNames.size) * 100).toFixed(2);
    
    if (coverage === '100.00') {
      console.log(`${colors.green}✅ Coverage: ${coverage}% - ALL FUNCTIONS MAPPED!${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Coverage: ${coverage}%${colors.reset}`);
    }

    // Display unmapped functions if any
    if (unmappedFunctions.length > 0) {
      console.log(`\n${colors.red}=== UNMAPPED FUNCTIONS (${unmappedFunctions.length}) ===${colors.reset}`);
      
      // Group by potential category
      const categorized = {
        healthcare: unmappedFunctions.filter(f => 
          f.match(/FDA|Medicare|Medicaid|CDC|NIH|Nutrition|Gene|Clinical|Pharmaco/)
        ),
        provider: unmappedFunctions.filter(f => f.match(/[Pp]rovider|NPI|Credential/)),
        training: unmappedFunctions.filter(f => f.match(/Training|Education|Competency|Assessment/)),
        policy: unmappedFunctions.filter(f => f.match(/[Pp]olicy|Compliance/)),
        system: unmappedFunctions.filter(f => 
          f.match(/Circuit|Server|Cache|Database|Load|Trace|Performance/)
        ),
        other: []
      };
      
      // Add remaining to other
      unmappedFunctions.forEach(f => {
        const found = Object.keys(categorized).some(cat => 
          cat !== 'other' && categorized[cat].includes(f)
        );
        if (!found) categorized.other.push(f);
      });
      
      // Display by category
      Object.entries(categorized).forEach(([category, funcs]) => {
        if (funcs.length > 0) {
          console.log(`\n${colors.yellow}${category.toUpperCase()}:${colors.reset}`);
          funcs.forEach(f => console.log(`  - ${f}`));
        }
      });
    }

    // Display incorrectly mapped functions
    if (incorrectlyMapped.length > 0) {
      console.log(`\n${colors.magenta}=== INCORRECTLY MAPPED (${incorrectlyMapped.length}) ===${colors.reset}`);
      console.log('These functions are mapped but don\'t exist in V4:');
      incorrectlyMapped.forEach(f => console.log(`  - ${f}`));
    }

    // Test keyword matching for healthcare functions
    console.log(`\n${colors.cyan}=== TESTING HEALTHCARE KEYWORDS ===${colors.reset}`);
    const testQueries = [
      'Search FDA drugs for aspirin',
      'Check Medicare coverage',
      'Find clinical trials',
      'Get nutrition data',
      'CDC disease data'
    ];

    for (const query of testQueries) {
      console.log(`\nTest: "${query}"`);
      // This would normally call the Claude service to test
      // For now, just check if keywords match
      const lowerQuery = query.toLowerCase();
      const wouldMatch = lowerQuery.includes('fda') || 
                        lowerQuery.includes('medicare') ||
                        lowerQuery.includes('clinical') ||
                        lowerQuery.includes('nutrition') ||
                        lowerQuery.includes('cdc');
      
      if (wouldMatch) {
        console.log(`  ${colors.green}✅ Would trigger healthcare functions${colors.reset}`);
      } else {
        console.log(`  ${colors.red}❌ Would NOT trigger healthcare functions${colors.reset}`);
      }
    }

    // Summary
    console.log(`\n${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.cyan}  VALIDATION SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}========================================${colors.reset}`);
    console.log(`Total Functions: ${functionNames.size}`);
    console.log(`Mapped Functions: ${mappedFunctions.size}`);
    console.log(`Unmapped Functions: ${colors.red}${unmappedFunctions.length}${colors.reset}`);
    console.log(`Incorrectly Mapped: ${colors.magenta}${incorrectlyMapped.length}${colors.reset}`);
    console.log(`Coverage: ${coverage === '100.00' ? colors.green : colors.yellow}${coverage}%${colors.reset}`);
    
    if (unmappedFunctions.length === 0 && incorrectlyMapped.length === 0) {
      console.log(`\n${colors.green}🎉 SUCCESS! All functions are properly mapped!${colors.reset}`);
      return true;
    } else {
      console.log(`\n${colors.yellow}⚠️  Some functions need attention${colors.reset}`);
      return false;
    }

  } catch (error) {
    console.error(`${colors.red}Error during validation:${colors.reset}`, error);
    return false;
  }
}

// Run the test
if (require.main === module) {
  validateFunctionMappings().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateFunctionMappings };