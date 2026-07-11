/**
 * Comprehensive Function Extractor
 * Automatically extracts ALL 1500+ functions from agentServiceV4
 * Generates intelligent query variations for each function
 */

const fs = require('fs');
const path = require('path');

class ComprehensiveFunctionExtractor {
  constructor() {
    this.allFunctions = [];
    this.functionMap = new Map();
  }

  /**
   * Extract ALL functions from agentServiceV4 and related files
   */
  async extractAllFunctions() {
    console.log('🔍 Extracting ALL 1500+ functions...');
    
    try {
      // Import agentServiceV4 to get all functions
      const agentServiceV4 = require('./agentServiceV4');
      
      // Get all function names from the service
      const functionNames = Object.getOwnPropertyNames(Object.getPrototypeOf(agentServiceV4))
        .filter(name => {
          // Filter to only include actual functions (not constructor, etc.)
          return typeof agentServiceV4[name] === 'function' && 
                 name !== 'constructor' &&
                 !name.startsWith('_') &&  // Skip private methods
                 name !== 'initialize' &&
                 name !== 'toString' &&
                 name !== 'valueOf';
        });

      console.log(`📊 Found ${functionNames.length} functions in agentServiceV4`);

      // Also get functions from the function list
      if (agentServiceV4.getAllFunctions) {
        const registeredFunctions = agentServiceV4.getAllFunctions();
        console.log(`📚 Found ${registeredFunctions.length} registered functions`);
        
        // Merge both lists
        const allFunctionNames = new Set([...functionNames]);
        registeredFunctions.forEach(func => {
          if (func.name) {
            allFunctionNames.add(func.name);
          }
        });

        console.log(`✅ Total unique functions: ${allFunctionNames.size}`);
        return Array.from(allFunctionNames);
      }

      return functionNames;
    } catch (error) {
      console.error('❌ Error extracting functions:', error);
      return [];
    }
  }

  /**
   * Generate intelligent query variations for a function
   */
  generateQueryVariations(functionName) {
    const variations = [];
    
    // Convert camelCase to readable format
    const readable = functionName
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim();
    
    variations.push(readable);
    
    // Common patterns based on function name
    if (functionName.startsWith('get')) {
      const subject = functionName.substring(3).replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      variations.push(`show ${subject}`);
      variations.push(`display ${subject}`);
      variations.push(`list ${subject}`);
      variations.push(`view ${subject}`);
      variations.push(subject);
    }
    
    if (functionName.startsWith('list')) {
      const subject = functionName.substring(4).replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      variations.push(`show ${subject}`);
      variations.push(`get ${subject}`);
      variations.push(`display ${subject}`);
      variations.push(subject);
    }
    
    if (functionName.startsWith('create') || functionName.startsWith('add')) {
      const subject = functionName.substring(functionName.startsWith('create') ? 6 : 3)
        .replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      variations.push(`new ${subject}`);
      variations.push(`add ${subject}`);
      variations.push(`create ${subject}`);
      variations.push(`make ${subject}`);
    }
    
    if (functionName.startsWith('update') || functionName.startsWith('edit')) {
      const subject = functionName.substring(functionName.startsWith('update') ? 6 : 4)
        .replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      variations.push(`edit ${subject}`);
      variations.push(`update ${subject}`);
      variations.push(`modify ${subject}`);
      variations.push(`change ${subject}`);
    }
    
    if (functionName.startsWith('delete') || functionName.startsWith('remove')) {
      const subject = functionName.substring(functionName.startsWith('delete') ? 6 : 6)
        .replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      variations.push(`delete ${subject}`);
      variations.push(`remove ${subject}`);
      variations.push(`cancel ${subject}`);
    }
    
    if (functionName.startsWith('search')) {
      const subject = functionName.substring(6).replace(/([A-Z])/g, ' $1').toLowerCase().trim();
      variations.push(`find ${subject}`);
      variations.push(`look for ${subject}`);
      variations.push(`search ${subject}`);
    }
    
    // Add Hebrew variations for common medical terms
    if (functionName.toLowerCase().includes('patient')) {
      variations.push('מטופל');
      variations.push('מטופלים');
      variations.push('הצג מטופלים');
    }
    
    if (functionName.toLowerCase().includes('appointment')) {
      variations.push('תור');
      variations.push('פגישה');
      variations.push('תורים');
      variations.push('פגישות');
    }
    
    if (functionName.toLowerCase().includes('medication')) {
      variations.push('תרופה');
      variations.push('תרופות');
      variations.push('מרשם');
    }
    
    if (functionName.toLowerCase().includes('doctor') || functionName.toLowerCase().includes('provider')) {
      variations.push('רופא');
      variations.push('רופאים');
      variations.push('מטפל');
    }
    
    // Remove duplicates
    return [...new Set(variations)];
  }

  /**
   * Build comprehensive function cache configuration
   */
  buildCacheConfiguration(functionNames) {
    const configurations = [];
    
    for (const functionName of functionNames) {
      // Determine TTL based on function type
      let ttl = 3600; // Default 1 hour
      
      if (functionName.includes('Vital') || functionName.includes('RealTime')) {
        ttl = 300; // 5 minutes for real-time data
      } else if (functionName.includes('Appointment') || functionName.includes('Schedule')) {
        ttl = 1800; // 30 minutes for appointments
      } else if (functionName.includes('Statistics') || functionName.includes('Analytics')) {
        ttl = 3600; // 1 hour for analytics
      } else if (functionName.includes('Clinic') || functionName.includes('Practice')) {
        ttl = 86400; // 24 hours for static clinic info
      } else if (functionName.includes('create') || functionName.includes('update') || functionName.includes('delete')) {
        continue; // Skip mutation functions - don't cache these
      }
      
      configurations.push({
        functionName: functionName,
        variations: this.generateQueryVariations(functionName),
        ttl: ttl
      });
    }
    
    return configurations;
  }

  /**
   * Generate and save complete cache configuration
   */
  async generateCompleteCacheConfig() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 GENERATING COMPLETE CACHE CONFIGURATION FOR ALL FUNCTIONS');
    console.log('='.repeat(60) + '\n');
    
    // Extract all functions
    const allFunctions = await this.extractAllFunctions();
    
    // Build cache configurations
    const configurations = this.buildCacheConfiguration(allFunctions);
    
    // Statistics
    const totalVariations = configurations.reduce((sum, config) => sum + config.variations.length, 0);
    
    console.log('\n📊 CACHE CONFIGURATION SUMMARY:');
    console.log(`   Total functions: ${allFunctions.length}`);
    console.log(`   Cacheable functions: ${configurations.length}`);
    console.log(`   Total query variations: ${totalVariations}`);
    console.log(`   Average variations per function: ${(totalVariations / configurations.length).toFixed(1)}`);
    
    // Save to file for use by cache warmer
    const outputPath = path.join(__dirname, 'functionCacheConfig.json');
    fs.writeFileSync(outputPath, JSON.stringify(configurations, null, 2));
    console.log(`\n💾 Configuration saved to: ${outputPath}`);
    
    // Show sample
    console.log('\n📝 Sample configurations:');
    configurations.slice(0, 5).forEach(config => {
      console.log(`\n   ${config.functionName}:`);
      console.log(`   TTL: ${config.ttl}s`);
      console.log(`   Variations: ${config.variations.join(', ')}`);
    });
    
    return configurations;
  }
}

// Create singleton instance
const extractor = new ComprehensiveFunctionExtractor();

module.exports = extractor;

// If run directly, generate the configuration
if (require.main === module) {
  extractor.generateCompleteCacheConfig().then(() => {
    console.log('\n✅ Complete cache configuration generated!');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
}