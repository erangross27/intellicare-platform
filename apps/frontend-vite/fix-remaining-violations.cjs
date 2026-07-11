#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Files to fix
const fixTargets = [
  'src/services/securityService.js',
  'src/utils/enhancedSessionManager.js',
  'src/components/chat/ChatContainer.js',
  'src/components/chat/components/SessionManager.js',
  'src/components/Diagnosis.js'
];

// Counters
let totalFixed = 0;
let filesFixed = 0;

// Fix console statements
function fixConsoleStatements(content, filePath) {
  let fixed = content;
  let count = 0;
  
  // Pattern to match unprotected console statements
  const consolePattern = /^(\s*)console\.(log|warn|error|info|debug)\(/gm;
  
  // Replace with production-protected version
  fixed = fixed.replace(consolePattern, (match, indent, method) => {
    // Check if already protected
    const lineStart = fixed.lastIndexOf('\n', fixed.indexOf(match));
    const prevLine = fixed.substring(lineStart, fixed.indexOf(match));
    if (prevLine.includes("process.env.NODE_ENV !== 'production'")) {
      return match; // Already protected
    }
    
    count++;
    return `${indent}process.env.NODE_ENV !== 'production' && console.${method}(`;
  });
  
  return { fixed, count };
}

// Fix localStorage/sessionStorage
function fixStorageUsage(content, filePath) {
  let fixed = content;
  let count = 0;
  
  // Check if already imports secureStorage
  if (!fixed.includes("import secureStorage from") && !fixed.includes("const secureStorage = require")) {
    // Add import at the top of the file
    if (fixed.includes('import ')) {
      // ES6 module
      const firstImport = fixed.indexOf('import ');
      fixed = fixed.slice(0, firstImport) + 
              "import secureStorage from '../utils/secureStorage';\n" + 
              fixed.slice(firstImport);
    } else if (fixed.includes('const ') || fixed.includes('require(')) {
      // CommonJS
      fixed = "const secureStorage = require('../utils/secureStorage');\n" + fixed;
    }
  }
  
  // Replace localStorage calls
  const localStoragePattern = /(?<!secureStorage\.)localStorage\.(getItem|setItem|removeItem|clear)/g;
  fixed = fixed.replace(localStoragePattern, (match, method) => {
    count++;
    return `secureStorage.${method}`;
  });
  
  // Replace sessionStorage calls
  const sessionStoragePattern = /(?<!secureStorage\.)sessionStorage\.(getItem|setItem|removeItem|clear)/g;
  fixed = fixed.replace(sessionStoragePattern, (match, method) => {
    count++;
    return `secureStorage.${method}`;
  });
  
  return { fixed, count };
}

// Process a file
function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`${colors.yellow}⚠ File not found: ${filePath}${colors.reset}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let totalChanges = 0;
    
    // Fix console statements
    const consoleResult = fixConsoleStatements(content, filePath);
    content = consoleResult.fixed;
    totalChanges += consoleResult.count;
    
    // Fix storage usage
    const storageResult = fixStorageUsage(content, filePath);
    content = storageResult.fixed;
    totalChanges += storageResult.count;
    
    if (totalChanges > 0) {
      fs.writeFileSync(fullPath, content);
      console.log(`${colors.green}✓ Fixed ${filePath}: ${totalChanges} violations${colors.reset}`);
      filesFixed++;
      totalFixed += totalChanges;
    } else {
      console.log(`${colors.blue}○ ${filePath}: No violations found${colors.reset}`);
    }
  } catch (error) {
    console.error(`${colors.yellow}⚠ Error processing ${filePath}: ${error.message}${colors.reset}`);
  }
}

// Main execution
console.log(`${colors.blue}Starting comprehensive violation fix...${colors.reset}\n`);

// Process each target file
fixTargets.forEach(processFile);

// Also fix any remaining files with high violations
const additionalFiles = [
  'src/components/PatientDashboard.js',
  'src/components/NewVisit.js',
  'src/components/PatientCard.js',
  'src/components/DocumentManagement.js',
  'src/chat-new/ChatContainer.js'
];

console.log(`\n${colors.blue}Checking additional files...${colors.reset}\n`);
additionalFiles.forEach(processFile);

// Summary
console.log(`\n${colors.green}════════════════════════════════════════${colors.reset}`);
console.log(`${colors.green}Fix Complete!${colors.reset}`);
console.log(`Files fixed: ${filesFixed}`);
console.log(`Total violations fixed: ${totalFixed}`);
console.log(`${colors.green}════════════════════════════════════════${colors.reset}\n`);

console.log('Run the security report again to verify all issues are resolved:');
console.log('  node generate-frontend-security-report.cjs');