/**
 * Simple Function Mapping Check
 * Counts functions without loading the services
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function extractFunctionsFromV4() {
  const filePath = path.join(__dirname, '../services/agentServiceV4.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract function names from the getAllPlatformFunctions method
  const functionPattern = /name:\s*["']([^"']+)["']/g;
  const functions = new Set();
  let match;
  
  while ((match = functionPattern.exec(content)) !== null) {
    functions.add(match[1]);
  }
  
  return functions;
}

function extractFunctionsFromClaude() {
  const filePath = path.join(__dirname, '../services/agentServiceClaude.js');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract function mappings
  const functionPattern = /functions:\s*\[([^\]]+)\]/g;
  const mappedFunctions = new Set();
  let match;
  
  while ((match = functionPattern.exec(content)) !== null) {
    const functionsStr = match[1];
    const functions = functionsStr.split(',').map(f => 
      f.trim().replace(/['"]/g, '')
    ).filter(f => f);
    
    functions.forEach(f => mappedFunctions.add(f));
  }
  
  return mappedFunctions;
}

console.log(`${colors.cyan}========================================${colors.reset}`);
console.log(`${colors.cyan}  Function Mapping Coverage Check${colors.reset}`);
console.log(`${colors.cyan}========================================${colors.reset}\n`);

try {
  const v4Functions = extractFunctionsFromV4();
  const claudeFunctions = extractFunctionsFromClaude();
  
  console.log(`${colors.blue}Functions in agentServiceV4:${colors.reset} ${v4Functions.size}`);
  console.log(`${colors.blue}Functions mapped in Claude:${colors.reset} ${claudeFunctions.size}`);
  
  // Find unmapped functions
  const unmapped = [];
  for (const func of v4Functions) {
    if (!claudeFunctions.has(func)) {
      unmapped.push(func);
    }
  }
  
  // Calculate coverage
  const coverage = ((claudeFunctions.size / v4Functions.size) * 100).toFixed(2);
  
  console.log(`\n${colors.cyan}=== COVERAGE ===${colors.reset}`);
  if (coverage === '100.00' || unmapped.length === 0) {
    console.log(`${colors.green}✅ Coverage: ${coverage}% - ALL FUNCTIONS MAPPED!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️  Coverage: ${coverage}%${colors.reset}`);
    console.log(`${colors.red}Unmapped functions: ${unmapped.length}${colors.reset}`);
  }
  
  // Show some unmapped functions if any
  if (unmapped.length > 0) {
    console.log(`\n${colors.red}=== SAMPLE OF UNMAPPED FUNCTIONS ===${colors.reset}`);
    unmapped.slice(0, 20).forEach(f => console.log(`  - ${f}`));
    if (unmapped.length > 20) {
      console.log(`  ... and ${unmapped.length - 20} more`);
    }
  }
  
  // Check for healthcare functions specifically
  const healthcareFuncs = [
    'searchFDADrugs', 'checkMedicareCoverage', 'searchClinicalTrials',
    'getNutritionData', 'getCDCDiseaseData'
  ];
  
  console.log(`\n${colors.cyan}=== HEALTHCARE FUNCTIONS CHECK ===${colors.reset}`);
  healthcareFuncs.forEach(func => {
    const inV4 = v4Functions.has(func);
    const inClaude = claudeFunctions.has(func);
    
    if (inV4 && inClaude) {
      console.log(`${colors.green}✅ ${func} - Properly mapped${colors.reset}`);
    } else if (inV4 && !inClaude) {
      console.log(`${colors.red}❌ ${func} - NOT mapped${colors.reset}`);
    } else if (!inV4) {
      console.log(`${colors.yellow}⚠️  ${func} - Not in V4${colors.reset}`);
    }
  });
  
  // Summary
  console.log(`\n${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}  SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`Total V4 Functions: ${v4Functions.size}`);
  console.log(`Mapped Functions: ${claudeFunctions.size}`);
  console.log(`Unmapped: ${unmapped.length}`);
  console.log(`Coverage: ${coverage}%`);
  
  if (unmapped.length === 0) {
    console.log(`\n${colors.green}🎉 SUCCESS! All functions are mapped!${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️  ${unmapped.length} functions still need mapping${colors.reset}`);
  }
  
} catch (error) {
  console.error(`${colors.red}Error:${colors.reset}`, error.message);
  process.exit(1);
}