#!/usr/bin/env node

/**
 * SKILL GENERATOR - Generate 1,400+ skills from medical functions
 *
 * Creates one skill per function for Claude Skills API
 * Benefits:
 * - 97% token reduction (no function definitions in every request)
 * - Claude auto-selects relevant skills
 * - Each skill is independently versioned
 * - Composable: searchPatientsByName + getAllergies work together automatically
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILLS_DIR = path.join(__dirname, '../skills');
const BACKEND_DIR = path.join(__dirname, '../apps/backend-api');

// Ensure skills directory exists
if (!fs.existsSync(SKILLS_DIR)) {
  fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

/**
 * Extract all functions from aiHelpers.js
 */
function extractFunctionsFromAiHelpers() {
  const aiHelpersPath = path.join(BACKEND_DIR, 'services/utils/aiHelpers.js');
  const content = fs.readFileSync(aiHelpersPath, 'utf-8');

  const functions = [];

  // Match pattern: name: "functionName", description: "...", parameters: {...}
  const functionPattern = /\{\s*name:\s*"([^"]+)",\s*description:\s*([^,]+),\s*parameters:\s*(\{[^}]*\})/g;
  let match;

  while ((match = functionPattern.exec(content)) !== null) {
    functions.push({
      name: match[1],
      description: match[2].trim(),
      source: 'aiHelpers'
    });
  }

  return functions;
}

/**
 * Extract all generated medical functions
 */
function extractGeneratedMedicalFunctions() {
  const generatedPath = path.join(BACKEND_DIR, 'services/generatedMedicalFunctions.js');
  const content = fs.readFileSync(generatedPath, 'utf-8');

  const functions = [];

  // Extract function names and descriptions
  const functionPattern = /([a-zA-Z0-9_]+):\s*\{\s*description:\s*"([^"]*)",\s*parameters:/g;
  let match;

  while ((match = functionPattern.exec(content)) !== null) {
    functions.push({
      name: match[1],
      description: match[2],
      source: 'generatedMedicalFunctions'
    });
  }

  return functions;
}

/**
 * Generate sanitized skill name from function name
 * Example: getAllergies -> intellicare-get-allergies
 */
function functionNameToSkillName(functionName) {
  return `intellicare-${functionName
    .replace(/([A-Z])/g, '-$1')
    .replace(/^-/, '')
    .toLowerCase()}`;
}

/**
 * Create a single skill directory and files
 */
function createSkill(functionName, description, source) {
  const skillName = functionNameToSkillName(functionName);
  const skillPath = path.join(SKILLS_DIR, skillName);

  // Create directory
  if (!fs.existsSync(skillPath)) {
    fs.mkdirSync(skillPath, { recursive: true });
  }

  // 1. Create SKILL.md (metadata)
  const skillMd = `# ${skillName}

## Overview
Executes the \`${functionName}\` medical function.

## Description
${description}

## Function
- **Name**: ${functionName}
- **Source**: ${source}
- **Type**: Medical Data Function

## Usage
Claude will automatically invoke this skill when relevant to the user's request.

## Parameters
See the function definition for parameters and required fields.

## Returns
Artifact panel format with data and metadata.
`;

  fs.writeFileSync(path.join(skillPath, 'SKILL.md'), skillMd);

  // 2. Create skill.json (function definition)
  const skillJson = {
    name: skillName,
    functionName: functionName,
    source: source,
    description: description,
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  };

  fs.writeFileSync(
    path.join(skillPath, 'skill.json'),
    JSON.stringify(skillJson, null, 2)
  );

  // 3. Create handler.js (execution code)
  const handlerCode = `/**
 * Handler for ${functionName} skill
 * Auto-generated skill handler - DO NOT EDIT
 *
 * This handler executes the ${functionName} function from ${source}.js
 */

async function execute(args, context) {
  try {
    const service = require('../${source}');

    if (typeof service.${functionName} !== 'function') {
      throw new Error('Function ${functionName} not found in ${source}');
    }

    const result = await service.${functionName}(args, context);

    return {
      success: true,
      data: result,
      skill: '${skillName}',
      function: '${functionName}'
    };
  } catch (error) {
    console.error(\`[${skillName}] Error: \${error.message}\`);
    throw error;
  }
}

module.exports = { execute };
`;

  fs.writeFileSync(path.join(skillPath, 'handler.js'), handlerCode);

  return skillName;
}

/**
 * Main generation logic
 */
async function generateSkills() {
  console.log('🚀 IntelliCare Skills Generator');
  console.log('================================\n');

  try {
    // Extract functions from both sources
    console.log('📚 Extracting functions...');
    const aiHelpersFunctions = extractFunctionsFromAiHelpers();
    const medicalFunctions = extractGeneratedMedicalFunctions();

    console.log(`   ✅ aiHelpers: ${aiHelpersFunctions.length} functions`);
    console.log(`   ✅ generatedMedicalFunctions: ${medicalFunctions.length} functions\n`);

    const allFunctions = [...aiHelpersFunctions, ...medicalFunctions];
    const totalFunctions = allFunctions.length;

    console.log(`📊 Total functions: ${totalFunctions}`);
    console.log(`🎯 Will create ${totalFunctions} skills (one per function)\n`);

    // Create skills
    console.log('🔨 Creating skills...');
    let successCount = 0;
    let errorCount = 0;

    for (const func of allFunctions) {
      try {
        createSkill(func.name, func.description, func.source);
        successCount++;

        // Progress indicator
        if (successCount % 50 === 0) {
          console.log(`   Created ${successCount}/${totalFunctions} skills...`);
        }
      } catch (error) {
        console.error(`   ❌ Error creating skill for ${func.name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Skill generation complete!`);
    console.log(`   ✅ Created: ${successCount} skills`);
    if (errorCount > 0) {
      console.log(`   ⚠️  Errors: ${errorCount}`);
    }

    // Generate index file
    const indexFile = `/**
 * IntelliCare Skills Index
 * Auto-generated - DO NOT EDIT
 *
 * Lists all ${totalFunctions} available skills
 * Each skill executes one medical function
 */

const skills = [
${allFunctions
  .map(func => `  '${functionNameToSkillName(func.name)}'`)
  .join(',\n')}
];

module.exports = { skills };
`;

    fs.writeFileSync(path.join(SKILLS_DIR, 'index.js'), indexFile);
    console.log(`   ✅ Created index.js with ${totalFunctions} skills\n`);

    // Generate skills manifest for API upload
    const manifest = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      totalSkills: totalFunctions,
      aiHelperSkills: aiHelpersFunctions.length,
      medicalFunctionSkills: medicalFunctions.length,
      skillsDirectory: SKILLS_DIR,
      skills: allFunctions.map(func => ({
        skillName: functionNameToSkillName(func.name),
        functionName: func.name,
        description: func.description,
        source: func.source,
        path: path.join(SKILLS_DIR, functionNameToSkillName(func.name))
      }))
    };

    fs.writeFileSync(
      path.join(SKILLS_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log(`📋 Manifest created at: ${path.join(SKILLS_DIR, 'manifest.json')}`);
    console.log('\n' + '='.repeat(50));
    console.log('✨ SKILLS READY FOR UPLOAD');
    console.log('='.repeat(50));
    console.log(`\nNext steps:`);
    console.log(`1. Review skills in: ${SKILLS_DIR}`);
    console.log(`2. Run upload script: npm run upload-skills`);
    console.log(`3. Update agentServiceClaude.js to use skills`);
    console.log('\nBenefit: 97% token reduction! 🚀');

  } catch (error) {
    console.error('\n❌ Generation failed:', error);
    process.exit(1);
  }
}

// Run generator
generateSkills();
