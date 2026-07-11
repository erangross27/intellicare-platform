/**
 * generate-agent-descriptions.js
 *
 * Reads collectionSystemPrompts.json and generates agent-friendly descriptions
 * for use in aiHelpers.js getShortDescription() method.
 *
 * The goal is to give the agent meaningful descriptions so it can find the right
 * function when users ask for things like "medical history" or "lab results".
 *
 * Usage: node scripts/generate-agent-descriptions.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const PROMPTS_PATH = path.join(__dirname, '../services/collectionSystemPrompts.json');
const OUTPUT_PATH = path.join(__dirname, '../services/agentFunctionDescriptions.json');
const AI_HELPERS_PATH = path.join(__dirname, '../services/utils/aiHelpers.js');

/**
 * Convert collection_name to function name
 * e.g., medical_history -> getMedicalHistory
 */
function collectionToFunctionName(collection) {
  const pascalCase = collection
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return `get${pascalCase}`;
}

/**
 * Convert collection_name to human-readable title
 * e.g., medical_history -> Medical History
 */
function collectionToTitle(collection) {
  return collection
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract field names from system prompt
 */
function extractFieldsFromPrompt(prompt) {
  if (!prompt) return [];

  // Look for JSON example in the prompt
  const jsonMatch = prompt.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1];
      // Find all field names (keys before colons)
      const fieldMatches = jsonStr.match(/"([a-zA-Z_]+)":/g);
      if (fieldMatches) {
        const fields = fieldMatches
          .map(m => m.replace(/"/g, '').replace(':', ''))
          .filter(f => !['key', 'Item'].includes(f) && !f.startsWith('_'));
        return [...new Set(fields)]; // Remove duplicates
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
  return [];
}

/**
 * Generate search phrases for a collection
 */
function generateSearchPhrases(collection, title) {
  const phrases = [title.toLowerCase()];

  // Add common variations
  const words = collection.split('_');
  if (words.length > 1) {
    phrases.push(words.join(' '));
    phrases.push(words.join('-'));
  }

  // Add common synonyms
  const synonyms = {
    'medical_history': ['patient history', 'health history', 'past medical', 'complete history', 'medical background'],
    'psychiatric_history': ['mental health history', 'psych history', 'previous mental health'],
    'vital_signs': ['vitals', 'blood pressure', 'heart rate', 'temperature'],
    'lab_results': ['labs', 'blood work', 'test results', 'laboratory'],
    'medications': ['meds', 'prescriptions', 'drugs', 'medicine'],
    'diagnoses': ['diagnosis', 'conditions', 'medical conditions'],
    'allergies': ['allergy', 'drug allergies', 'food allergies'],
    'immunizations': ['vaccines', 'vaccinations', 'shots'],
    'procedures': ['surgeries', 'operations', 'interventions'],
  };

  if (synonyms[collection]) {
    phrases.push(...synonyms[collection]);
  }

  return phrases;
}

/**
 * Generate a concise description for the agent
 */
function generateDescription(collection, prompt, isHebrew = false) {
  const title = collectionToTitle(collection);
  const titleUpper = title.toUpperCase();
  const fields = extractFieldsFromPrompt(prompt);
  const searchPhrases = generateSearchPhrases(collection, title);

  // Create field list (max 8 fields for brevity)
  const fieldList = fields.slice(0, 8).map(f => f.replace(/([A-Z])/g, ' $1').toLowerCase().trim()).join(', ');
  const hasMoreFields = fields.length > 8 ? ', and more' : '';

  // Create search phrase list
  const phraseList = searchPhrases.slice(0, 5).map(p => `'${p}'`).join(', ');

  if (isHebrew) {
    return `${titleUpper} - קבל נתוני ${title.toLowerCase()} של המטופל`;
  }

  let desc = `${titleUpper} - Get patient's ${title.toLowerCase()}`;

  if (fieldList) {
    desc += ` including ${fieldList}${hasMoreFields}`;
  }

  desc += `. Use when user asks for ${phraseList}`;

  return desc;
}

/**
 * Main function
 */
async function main() {
  console.log('🔄 Reading collectionSystemPrompts.json...');

  // Read the prompts file
  const promptsData = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  const collections = Object.keys(promptsData);

  console.log(`📊 Found ${collections.length} collections with prompts`);

  // Generate descriptions
  const descriptions = {};
  const englishDescriptions = {};
  const hebrewDescriptions = {};

  for (const collection of collections) {
    const prompt = promptsData[collection];
    const funcName = collectionToFunctionName(collection);

    englishDescriptions[funcName] = generateDescription(collection, prompt, false);
    hebrewDescriptions[funcName] = generateDescription(collection, prompt, true);

    descriptions[collection] = {
      functionName: funcName,
      english: englishDescriptions[funcName],
      hebrew: hebrewDescriptions[funcName],
      fields: extractFieldsFromPrompt(prompt),
    };
  }

  // Save to JSON file for reference
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(descriptions, null, 2));
  console.log(`✅ Saved ${collections.length} descriptions to ${OUTPUT_PATH}`);

  // Generate JavaScript code for aiHelpers.js getShortDescription
  const jsCode = generateJSCode(englishDescriptions, hebrewDescriptions);

  // Save JS snippet
  const jsSnippetPath = path.join(__dirname, '../services/utils/generated-short-descriptions.js');
  fs.writeFileSync(jsSnippetPath, jsCode);
  console.log(`✅ Saved JavaScript snippet to ${jsSnippetPath}`);

  // Show sample
  console.log('\n📝 Sample descriptions:');
  const sampleCollections = ['medical_history', 'vital_signs', 'lab_results', 'psychiatric_history', 'medications'];
  for (const coll of sampleCollections) {
    if (descriptions[coll]) {
      console.log(`\n${coll}:`);
      console.log(`  ${descriptions[coll].english}`);
    }
  }

  console.log('\n✅ Done! Review the generated files and integrate into aiHelpers.js');
}

/**
 * Generate JavaScript code for getShortDescription method
 */
function generateJSCode(englishDescriptions, hebrewDescriptions) {
  let code = `/**
 * Generated Short Descriptions for Agent Functions
 * Generated on: ${new Date().toISOString()}
 *
 * These descriptions are derived from collectionSystemPrompts.json
 * and are designed to help the agent find the right function.
 *
 * To use: Copy the relevant entries into getShortDescription() in aiHelpers.js
 */

const getGeneratedDescriptions = (isHebrew) => ({
`;

  const funcNames = Object.keys(englishDescriptions).sort();

  for (const funcName of funcNames) {
    const en = englishDescriptions[funcName].replace(/"/g, '\\"');
    const he = hebrewDescriptions[funcName].replace(/"/g, '\\"');
    code += `  ${funcName}: isHebrew ? "${he}" : "${en}",\n`;
  }

  code += `});

module.exports = { getGeneratedDescriptions };
`;

  return code;
}

// Run
main().catch(console.error);
