/**
 * Extract exact grid definitions from switch statement
 * Creates individual grid files with the EXACT columns and mappers from the switch
 */

const fs = require('fs');
const path = require('path');

// Read the agentServiceV4.js file with the switch statement
const agentFile = fs.readFileSync(
  path.join(__dirname, '../agentServiceV4.js'),
  'utf8'
);

// Extract the switch statement section (commented out part)
const lines = agentFile.split('\n');

// Find the switch statement in the commented section
let switchStart = -1;
let switchEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('/* OLD CODE REMOVED:') && lines[i].includes('switch(category)')) {
    switchStart = i;
  }
  if (switchStart > 0 && lines[i].includes('END OF REMOVED SWITCH STATEMENT */')) {
    switchEnd = i;
    break;
  }
}

console.log(`📍 Switch statement found: lines ${switchStart} to ${switchEnd}`);

// Parse each case from the switch
const cases = [];
let currentCase = null;
let braceDepth = 0;
let inCase = false;

for (let i = switchStart; i < switchEnd; i++) {
  const line = lines[i];

  // Detect case statement
  if (line.trim().match(/^case '(.+)':$/)) {
    const caseName = line.match(/case '(.+)':/)[1];

    if (currentCase) {
      cases.push(currentCase);
    }

    currentCase = {
      name: caseName,
      lines: [],
      title: '',
      columns: [],
      hasMapper: false
    };
    inCase = true;
    continue;
  }

  // Detect break (end of case)
  if (inCase && line.trim() === 'break;') {
    if (currentCase) {
      cases.push(currentCase);
      currentCase = null;
    }
    inCase = false;
    continue;
  }

  // Collect lines for current case
  if (inCase && currentCase) {
    currentCase.lines.push(line);

    // Extract title
    if (line.includes('gridConfig.title = ')) {
      const match = line.match(/gridConfig\.title = '(.+)';/);
      if (match) currentCase.title = match[1];
    }

    // Extract columns
    if (line.includes('gridConfig.columns = ')) {
      const match = line.match(/gridConfig\.columns = (\[.+\]);/);
      if (match) {
        try {
          currentCase.columns = JSON.parse(match[1]);
        } catch (e) {
          console.error(`Failed to parse columns for ${currentCase.name}`);
        }
      }
    }

    // Detect mapper
    if (line.includes('gridConfig.data = categoryData.map')) {
      currentCase.hasMapper = true;
    }
  }
}

console.log(`✅ Found ${cases.length} cases in switch statement`);

// Now extract the exact mapper function for each case
cases.forEach(caseInfo => {
  console.log(`\n📋 ${caseInfo.name}`);
  console.log(`   Title: ${caseInfo.title}`);
  console.log(`   Columns: ${caseInfo.columns.join(', ')}`);
  console.log(`   Has Mapper: ${caseInfo.hasMapper}`);
});

console.log(`\n✅ Ready to create ${cases.length} grid files from switch statement`);
console.log(`📝 Next: Extract mapper functions and create individual .js files`);
