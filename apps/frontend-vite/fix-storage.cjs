const fs = require('fs');
const glob = require('glob');
const path = require('path');

let totalFixed = 0;
let filesModified = [];

const files = glob.sync('src/**/*.{js,jsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let modified = false;

  // Skip if already using SecureStorage
  if (content.includes('secureStorage') || content.includes('SecureStorage')) {
    // Already migrated
    return;
  }

  // Check if file uses localStorage/sessionStorage
  if (content.includes('localStorage') || content.includes('sessionStorage')) {
    // Determine import path depth
    const depth = file.split(path.sep).length - 2; // -2 for 'src' and filename
    const importPath = depth > 0 
      ? '../'.repeat(depth) + 'utils/secureStorage'
      : './utils/secureStorage';

    // Add import if not present
    if (!content.includes('import secureStorage') && !content.includes('from secureStorage')) {
      // Find the right place to add import (after other imports)
      const importRegex = /^import .* from ['"].*['"];?\s*$/gm;
      const lastImport = [...content.matchAll(importRegex)].pop();
      
      if (lastImport) {
        const insertPosition = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertPosition) + 
                  `\nimport secureStorage from '${importPath}';` +
                  content.slice(insertPosition);
      } else {
        // No imports found, add at the beginning
        content = `import secureStorage from '${importPath}';\n\n` + content;
      }
      modified = true;
    }

    // Replace localStorage patterns
    const replacements = [
      // localStorage.setItem
      [/localStorage\.setItem\(['"`]([^'"`]+)['"`],\s*/g, 'secureStorage.setItem(\'$1\', '],
      // localStorage.getItem
      [/localStorage\.getItem\(['"`]([^'"`]+)['"`]\)/g, 'secureStorage.getItem(\'$1\')'],
      // localStorage.removeItem
      [/localStorage\.removeItem\(['"`]([^'"`]+)['"`]\)/g, 'secureStorage.removeItem(\'$1\')'],
      // localStorage.clear
      [/localStorage\.clear\(\)/g, 'secureStorage.clear()'],
      // localStorage['key']
      [/localStorage\[['"`]([^'"`]+)['"`]\]/g, 'secureStorage.getItem(\'$1\')'],
      
      // sessionStorage.setItem
      [/sessionStorage\.setItem\(['"`]([^'"`]+)['"`],\s*/g, 'secureStorage.setItem(\'$1\', '],
      // sessionStorage.getItem
      [/sessionStorage\.getItem\(['"`]([^'"`]+)['"`]\)/g, 'secureStorage.getItem(\'$1\')'],
      // sessionStorage.removeItem
      [/sessionStorage\.removeItem\(['"`]([^'"`]+)['"`]\)/g, 'secureStorage.removeItem(\'$1\')'],
      // sessionStorage.clear
      [/sessionStorage\.clear\(\)/g, 'secureStorage.clear()'],
      // sessionStorage['key']
      [/sessionStorage\[['"`]([^'"`]+)['"`]\]/g, 'secureStorage.getItem(\'$1\')']
    ];

    replacements.forEach(([pattern, replacement]) => {
      const before = content;
      content = content.replace(pattern, replacement);
      if (before !== content) {
        modified = true;
      }
    });

    // Count fixes
    const fixes = (originalContent.match(/localStorage\.|sessionStorage\./g) || []).length;
    
    if (modified) {
      fs.writeFileSync(file, content);
      console.log(`✅ Fixed ${fixes} storage calls in: ${file}`);
      totalFixed += fixes;
      filesModified.push(file);
    }
  }
});

console.log('\n=== STORAGE MIGRATION COMPLETE ===');
console.log(`Total fixes: ${totalFixed}`);
console.log(`Files modified: ${filesModified.length}`);

if (filesModified.length > 0) {
  console.log('\nModified files:');
  filesModified.forEach(f => console.log(`  - ${f}`));
}