/**
 * Semantic Query Router
 * Maps ANY user prompt to cached function results using semantic similarity
 * This ensures cache hits even when prompts are worded differently!
 */

const redisCache = require('./redisCache');
const crypto = require('crypto');

class SemanticQueryRouter {
  constructor() {
    this.initialized = false;
    this.queryPatterns = this.buildQueryPatterns();
  }

  /**
   * Build patterns that map queries to function names
   */
  buildQueryPatterns() {
    return [
      {
        functionName: 'listAllPatients',
        patterns: [
          /\b(show|list|display|get|view|see|find)\s*(all|my)?\s*patients?\b/i,
          /\bpatients?\s*(list|roster)?\b/i,
          /\b(who|which)\s*(are|is)\s*(my|the)?\s*patients?\b/i,
          /מטופל/i, // Hebrew: patient
          /רשימת\s*מטופל/i // Hebrew: patient list
        ],
        keywords: ['patient', 'patients', 'roster', 'list', 'מטופל'],
        confidence: 0.8
      },
      {
        functionName: 'getTodaysAppointments',
        patterns: [
          /\b(today|todays?)\s*(appointments?|schedule|visits?)/i,
          /\b(appointments?|schedule|visits?)\s*(for\s*)?(today|now)/i,
          /\b(what|show|list|get)\s*(appointments?|schedule).*today/i,
          /\b(who|which)\s*(patients?)?.*\btoday\b/i,
          /פגישות\s*היום/i, // Hebrew: appointments today
          /לוז\s*היום/i // Hebrew: schedule today
        ],
        keywords: ['today', 'appointment', 'schedule', 'היום', 'פגישה'],
        confidence: 0.9
      },
      {
        functionName: 'getRecentPatients',
        patterns: [
          /\b(recent|latest|new|last|newest)\s*patients?\b/i,
          /\bpatients?\s*(added|registered|joined)\s*(recently|lately)/i,
          /\b(who|which)\s*(are|were)\s*the\s*(recent|latest|new)\s*patients?/i,
          /מטופלים\s*(אחרונים|חדשים)/i // Hebrew: recent/new patients
        ],
        keywords: ['recent', 'latest', 'new', 'last', 'אחרון', 'חדש'],
        confidence: 0.85
      },
      {
        functionName: 'getPracticeStatistics',
        patterns: [
          /\b(practice|clinic|office)\s*(stats?|statistics|analytics|overview|summary)/i,
          /\b(dashboard|metrics|numbers|data|report)\b/i,
          /\b(show|get|display)\s*(practice|clinic)?\s*(stats?|statistics|overview)/i,
          /סטטיסטיק/i, // Hebrew: statistics
          /סיכום\s*מרפאה/i // Hebrew: clinic summary
        ],
        keywords: ['statistics', 'stats', 'analytics', 'dashboard', 'overview', 'סטטיסטיקה'],
        confidence: 0.75
      },
      {
        functionName: 'getUpcomingAppointments',
        patterns: [
          /\b(upcoming|future|next|scheduled|planned)\s*(appointments?|visits?|schedule)/i,
          /\b(appointments?|visits?|schedule)\s*(coming\s*up|ahead|soon|next)/i,
          /\b(what|show|list)\s*(appointments?|visits?)\s*(are\s*)?(coming|scheduled|planned)/i,
          /פגישות\s*(עתידיות|קרובות)/i // Hebrew: upcoming appointments
        ],
        keywords: ['upcoming', 'future', 'next', 'scheduled', 'עתיד', 'קרוב'],
        confidence: 0.85
      },
      {
        functionName: 'getMedicalAlerts',
        patterns: [
          /\b(medical|patient|health)\s*(alerts?|warnings?|notifications?)/i,
          /\b(critical|urgent|important)\s*(alerts?|issues?|notifications?)/i,
          /\b(show|list|get)\s*(medical)?\s*alerts?/i,
          /התראות\s*רפואיות/i, // Hebrew: medical alerts
          /אזהרות/i // Hebrew: warnings
        ],
        keywords: ['alert', 'warning', 'urgent', 'critical', 'התראה', 'אזהרה'],
        confidence: 0.9
      },
      {
        functionName: 'getPatientProvider',
        patterns: [
          /\b(show|list|get|display)\s*(doctors?|providers?|physicians?|staff)/i,
          /\b(medical|clinic|practice)\s*(staff|team|providers?)/i,
          /\b(who|which)\s*(are|is)\s*(the|our)?\s*(doctors?|providers?|staff)/i,
          /רופא/i, // Hebrew: doctor
          /צוות\s*רפואי/i // Hebrew: medical staff
        ],
        keywords: ['doctor', 'provider', 'physician', 'staff', 'רופא', 'צוות'],
        confidence: 0.8
      }
    ];
  }

  /**
   * Calculate similarity score between query and pattern
   */
  calculateSimilarity(query, pattern) {
    const lowerQuery = query.toLowerCase();
    let score = 0;
    let matches = 0;

    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(query)) {
        score += 0.5;
        matches++;
      }
    }

    // Check keywords
    for (const keyword of pattern.keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        score += 0.3;
        matches++;
      }
    }

    // Bonus for multiple matches
    if (matches > 1) {
      score *= 1.2;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Find best matching function for a query
   */
  findBestMatch(query) {
    let bestMatch = null;
    let bestScore = 0;

    for (const pattern of this.queryPatterns) {
      const score = this.calculateSimilarity(query, pattern);
      
      if (score > bestScore && score >= pattern.confidence) {
        bestScore = score;
        bestMatch = {
          functionName: pattern.functionName,
          score: score,
          confidence: pattern.confidence
        };
      }
    }

    return bestMatch;
  }

  /**
   * Try to get cached result for a query
   */
  async getCachedResult(query, practiceId = 'stanford') {
    try {
      // Find best matching function
      const match = this.findBestMatch(query);
      
      if (!match) {
        console.log(`   ⚠️ No semantic match for: "${query}"`);
        return null;
      }

      console.log(`   🎯 Semantic match: ${match.functionName} (confidence: ${(match.score * 100).toFixed(0)}%)`);

      // Try to find cached result for this function
      const client = redisCache.client;
      if (!client || !redisCache.connected) {
        return null;
      }

      // Search for cached results with this function name
      const keys = await client.keys('function:result:*');
      
      for (const key of keys) {
        try {
          const cached = await client.get(key);
          if (cached) {
            const data = JSON.parse(cached);
            
            // Check if it's for the same function and practice
            if (data.functionName === match.functionName && 
                (data.practiceId === practiceId || !data.practiceId)) {
              
              console.log(`   ✅ Cache HIT! Using cached ${match.functionName} result`);
              
              // Update access time
              data.lastAccessed = new Date().toISOString();
              await client.setex(key, 3600, JSON.stringify(data));
              
              return {
                cached: true,
                functionName: match.functionName,
                result: data.result,
                matchScore: match.score,
                source: 'semantic-router-cache'
              };
            }
          }
        } catch (err) {
          // Skip invalid entries
        }
      }

      console.log(`   ⚠️ No cached result found for ${match.functionName}`);
      return null;

    } catch (error) {
      console.error('Semantic routing error:', error);
      return null;
    }
  }

  /**
   * Check if a query can be routed to cached function
   */
  async routeQuery(query, practiceId = 'stanford') {
    console.log(`\n🔍 Semantic Query Router: "${query}"`);
    
    const result = await this.getCachedResult(query, practiceId);
    
    if (result) {
      console.log(`   🚀 Routed to cached function: ${result.functionName}`);
      return result;
    }
    
    console.log(`   🔄 No cache route found, will process normally`);
    return null;
  }
}

// Create singleton instance
const semanticRouter = new SemanticQueryRouter();

module.exports = semanticRouter;