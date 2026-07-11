const fs = require('fs');
const path = require('path');

// Files to fix
const files = [
  'src/services/securityService.js',
  'src/config/languages.js', 
  'src/components/chat/ChatContainer.js',
  'src/utils/secureStorageV2.js',
  'src/utils/secureStorage.js',
  'src/services/secureApiClient.js',
  'src/hooks/useClinicInfo.js',
  'src/context/AuthContext.js',
  'src/config/languagesStatic.js',
  'src/services/cachedApi.js'
];

function wrapConsoleStatements(content) {
  // Pattern to match console.log/error/warn/info statements
  const consolePattern = /^(\s*)(console\.(log|error|warn|info)\([^)]*\);?)$/gm;
  
  // Replace with wrapped version
  return content.replace(consolePattern, (match, indent, statement) => {
    // Check if already wrapped
    if (content.substring(content.lastIndexOf('\n', content.indexOf(match)) - 100, content.indexOf(match)).includes('process.env.NODE_ENV')) {
      return match; // Already wrapped, skip
    }
    return `${indent}process.env.NODE_ENV !== 'production' && ${statement}`;
  });
}

console.log('=== Fixing Console Statements in Frontend Files ===\n');

let fixedCount = 0;
let errorCount = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${file}`);
      errorCount++;
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = wrapConsoleStatements(content);
    
    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✅ Fixed: ${file}`);
      fixedCount++;
    } else {
      console.log(`ℹ️  No changes needed: ${file}`);
    }
  } catch (error) {
    console.log(`❌ Error processing ${file}: ${error.message}`);
    errorCount++;
  }
});

console.log('\n=== Summary ===');
console.log(`✅ Fixed: ${fixedCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log(`Total processed: ${files.length} files`);