#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

// Directories to scan
const scanDirs = [
  'src/components',
  'src/services', 
  'src/utils',
  'src/pages',
  'src/chat-new'
];

// Files to skip
const skipFiles = [
  'api.js', // Already marked as deprecated
  'api.js.deprecated',
  'secureApiClient.js',
  'secureStorage.js',
  'secureStorageV2.js'
];

// Counters
let totalFixed = 0;
let filesProcessed = 0;
let filesFixed = 0;

// Fix console statements
function fixConsoleStatements(content) {
  let fixed = content;
  let count = 0;
  
  // Pattern to match unprotected console statements (not preceded by production check)
  const lines = fixed.split('\n');
  const fixedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if line contains console statement
    if (trimmed.match(/^console\.(log|warn|error|info|debug)\(/)) {
      // Check if previous line has production check
      const prevLine = i > 0 ? lines[i-1].trim() : '';
      if (!prevLine.includes("process.env.NODE_ENV !== 'production'")) {
        // Add production check
        const indent = line.match(/^\s*/)[0];
        fixedLines.push(`${indent}process.env.NODE_ENV !== 'production' && ${trimmed}`);
        count++;
      } else {
        fixedLines.push(line);
      }
    } else if (line.includes('console.') && !line.includes("process.env.NODE_ENV !== 'production'")) {
      // Handle inline console statements
      const fixedLine = line.replace(
        /(\s*)console\.(log|warn|error|info|debug)\(/g,
        "$1process.env.NODE_ENV !== 'production' && console.$2("
      );
      if (fixedLine !== line) {
        count++;
        fixedLines.push(fixedLine);
      } else {
        fixedLines.push(line);
      }
    } else {
      fixedLines.push(line);
    }
  }
  
  return { fixed: fixedLines.join('\n'), count };
}

// Fix storage usage
function fixStorageUsage(content, filePath) {
  let fixed = content;
  let count = 0;
  
  // Skip if file is the secure storage itself
  if (filePath.includes('secureStorage')) {
    return { fixed, count };
  }
  
  // Check if imports are needed
  const hasImport = fixed.includes("import secureStorage") || fixed.includes("const secureStorage");
  
  // Replace sessionStorage calls
  const sessionPattern = /(?<!secureStorage\.)sessionStorage\.(getItem|setItem|removeItem|clear)/g;
  const sessionMatches = fixed.match(sessionPattern) || [];
  
  if (sessionMatches.length > 0) {
    // Add import if needed
    if (!hasImport) {
      // Determine import path based on file location
      const depth = filePath.split('/').length - 2; // -1 for src, -1 for current
      const importPath = '../'.repeat(depth) + 'utils/secureStorage';
      
      if (fixed.includes('import ')) {
        // ES6 module
        const firstImport = fixed.indexOf('import ');
        fixed = fixed.slice(0, firstImport) + 
                `import secureStorage from '${importPath}';\n` + 
                fixed.slice(firstImport);
      } else {
        // Add at top
        fixed = `import secureStorage from '${importPath}';\n` + fixed;
      }
    }
    
    // Replace calls
    fixed = fixed.replace(sessionPattern, (match, method) => {
      count++;
      return `secureStorage.${method}`;
    });
  }
  
  return { fixed, count };
}

// Fix axios usage (for files other than api.js)
function fixAxiosUsage(content, filePath) {
  let fixed = content;
  let count = 0;
  
  // Skip api.js files
  if (filePath.includes('api.js')) {
    return { fixed, count };
  }
  
  // Check for axios import
  if (fixed.includes('import axios') || fixed.includes("require('axios')")) {
    // Remove axios import
    fixed = fixed.replace(/import\s+axios\s+from\s+['"]axios['"];?\n?/g, '');
    fixed = fixed.replace(/const\s+axios\s+=\s+require\(['"]axios['"]\);?\n?/g, '');
    
    // Add secureApiClient import if not present
    if (!fixed.includes('import secureApi') && !fixed.includes('const secureApi')) {
      // Determine import path
      const depth = filePath.split('/').length - 2;
      const importPath = '../'.repeat(depth) + 'services/secureApiClient';
      
      if (fixed.includes('import ')) {
        const firstImport = fixed.indexOf('import ');
        fixed = fixed.slice(0, firstImport) + 
                `import secureApi from '${importPath}';\n` + 
                fixed.slice(firstImport);
      } else {
        fixed = `import secureApi from '${importPath}';\n` + fixed;
      }
    }
    
    // Replace axios calls
    fixed = fixed.replace(/axios\.(get|post|put|delete|patch)/g, 'secureApi.$1');
    count++;
  }
  
  return { fixed, count };
}

// Process a file
function processFile(filePath) {
  const fileName = path.basename(filePath);
  
  // Skip ignored files
  if (skipFiles.includes(fileName)) {
    return;
  }
  
  // Only process JS/JSX files
  if (!filePath.endsWith('.js') && !filePath.endsWith('.jsx')) {
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let totalChanges = 0;
    filesProcessed++;
    
    // Fix console statements
    const consoleResult = fixConsoleStatements(content);
    content = consoleResult.fixed;
    totalChanges += consoleResult.count;
    
    // Fix storage usage
    const storageResult = fixStorageUsage(content, filePath);
    content = storageResult.fixed;
    totalChanges += storageResult.count;
    
    // Fix axios usage
    const axiosResult = fixAxiosUsage(content, filePath);
    content = axiosResult.fixed;
    totalChanges += axiosResult.count;
    
    if (totalChanges > 0) {
      fs.writeFileSync(filePath, content);
      const relativePath = path.relative(process.cwd(), filePath);
      console.log(`${colors.green}✓ Fixed ${relativePath}: ${totalChanges} violations${colors.reset}`);
      filesFixed++;
      totalFixed += totalChanges;
    }
  } catch (error) {
    console.error(`${colors.red}Error processing ${filePath}: ${error.message}${colors.reset}`);
  }
}

// Recursively scan directory
function scanDirectory(dir) {
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        processFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error scanning directory ${dir}: ${error.message}${colors.reset}`);
  }
}

// Main execution
console.log(`${colors.blue}Starting comprehensive security fix...${colors.reset}\n`);

// Scan all directories
for (const dir of scanDirs) {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.log(`${colors.blue}Scanning ${dir}...${colors.reset}`);
    scanDirectory(fullPath);
  }
}

// Summary
console.log(`\n${colors.green}════════════════════════════════════════${colors.reset}`);
console.log(`${colors.green}Fix Complete!${colors.reset}`);
console.log(`Files processed: ${filesProcessed}`);
console.log(`Files fixed: ${filesFixed}`);
console.log(`Total violations fixed: ${totalFixed}`);
console.log(`${colors.green}════════════════════════════════════════${colors.reset}\n`);

console.log('Run the security report to verify:');
console.log('  node generate-frontend-security-report.cjs');