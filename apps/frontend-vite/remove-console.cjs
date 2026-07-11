const fs = require('fs');
const glob = require('glob');

let totalFixed = 0;
let filesModified = [];

const files = glob.sync('src/**/*.{js,jsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let modified = false;

  // Skip if already has production check
  if (content.includes("process.env.NODE_ENV !== 'production' && console")) {
    return;
  }

  // Add production check for console
  if (content.includes('console.')) {
    // Replace console.log/debug/info/warn/error with conditional
    const patterns = [
      [/console\.log\(/g, "process.env.NODE_ENV !== 'production' && console.log("],
      [/console\.debug\(/g, "process.env.NODE_ENV !== 'production' && console.debug("],
      [/console\.info\(/g, "process.env.NODE_ENV !== 'production' && console.info("],
      [/console\.warn\(/g, "process.env.NODE_ENV !== 'production' && console.warn("],
      // Keep console.error in production for critical errors
      [/console\.error\(/g, "console.error("]
    ];

    patterns.forEach(([pattern, replacement]) => {
      const before = content;
      content = content.replace(pattern, replacement);
      if (before !== content) {
        modified = true;
      }
    });

    // Count fixes
    const fixes = (originalContent.match(/console\.(log|debug|info|warn)/g) || []).length;
    
    if (modified && fixes > 0) {
      fs.writeFileSync(file, content);
      console.log(`✅ Secured ${fixes} console statements in: ${file}`);
      totalFixed += fixes;
      filesModified.push(file);
    }
  }
});

console.log('\n=== CONSOLE SECURITY COMPLETE ===');
console.log(`Total console statements secured: ${totalFixed}`);
console.log(`Files modified: ${filesModified.length}`);
console.log('Console logs secured for production');