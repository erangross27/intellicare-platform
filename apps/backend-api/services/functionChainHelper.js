/**
 * Function Chain Helper
 * Automatically chains related functions when appropriate
 *
 * For example: When user asks for "details about X", we need to:
 * 1. Search for X first
 * 2. Then get details using the ID from search results
 */

class FunctionChainHelper {
  constructor() {
    // Define function chains - when function A returns results, automatically call function B
    this.functionChains = {
      // When searching for a patient by name - check what they want
      'searchPatientsByName': {
        triggers: ['details', 'information', 'info', 'tell me about', 'show me'],
        chainTo: 'getPatientDetails',
        alternativeChains: [
          {
            triggers: ['appointment', 'scheduled', 'schedule', 'upcoming', 'visit', 'booking'],
            chainTo: 'getAppointments'
          }
        ],
        extractId: (result) => {
          // Extract patient ID from search results
          if (result.data && result.data.length > 0) {
            return result.data[0]._id || result.data[0].id || result.data[0].patientId;
          }
          if (result.patients && result.patients.length > 0) {
            return result.patients[0]._id || result.patients[0].id || result.patients[0].patientId;
          }
          return null;
        }
      },

      // When finding a patient and user wants appointments, chain getAppointments
      'findPatient': {
        triggers: ['appointment', 'schedule', 'upcoming', 'visit'],
        chainTo: 'getAppointments',
        extractId: (result) => {
          if (result.data) {
            return result.data._id || result.data.id || result.data.patientId;
          }
          return null;
        }
      }
    };
  }

  /**
   * Check if we should chain another function based on the query and results
   */
  shouldChain(functionName, userQuery, result) {
    const chain = this.functionChains[functionName];
    if (!chain) return null;

    const queryLower = userQuery.toLowerCase();

    // Check alternative chains first (for appointments, medications, etc.)
    if (chain.alternativeChains) {
      for (const altChain of chain.alternativeChains) {
        const hasAltTrigger = altChain.triggers.some(trigger => queryLower.includes(trigger));
        if (hasAltTrigger) {
          const id = chain.extractId(result);
          if (!id) return null;

          return {
            functionName: altChain.chainTo,
            patientId: id
          };
        }
      }
    }

    // Check primary chain triggers
    const hasTrigger = chain.triggers.some(trigger => queryLower.includes(trigger));
    if (!hasTrigger) return null;

    // Check if we have results to chain from
    const id = chain.extractId(result);
    if (!id) return null;

    return {
      functionName: chain.chainTo,
      patientId: id
    };
  }

  /**
   * Build the tool call for the chained function
   */
  buildChainedToolCall(chainInfo) {
    return {
      type: 'tool_use',
      id: `chain_${Date.now()}`,
      name: chainInfo.functionName,
      input: {
        patientId: chainInfo.patientId
      }
    };
  }

  /**
   * Check if Claude should have chained functions but didn't
   * Returns additional tool calls if needed
   */
  getAdditionalToolCalls(executedFunction, result, userQuery, selectedFunctions) {
    // Check if the next function was in the selected functions but not executed
    const chainInfo = this.shouldChain(executedFunction, userQuery, result);

    if (!chainInfo) return [];

    // Check if Claude already called the chained function
    const wasSelected = selectedFunctions.includes(chainInfo.functionName);
    if (!wasSelected) {
      console.log(`⚠️ Chain function ${chainInfo.functionName} was not selected by two-stage selector`);
      return [];
    }

    console.log(`🔗 AUTO-CHAINING: ${executedFunction} → ${chainInfo.functionName}`);
    console.log(`  Reason: User query contains trigger words and function was selected but not executed`);

    return [this.buildChainedToolCall(chainInfo)];
  }
}

module.exports = new FunctionChainHelper();