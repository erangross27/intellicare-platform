/**
 * Two-Stage Claude Function Selection
 * Stage 1: Send only function names to Claude for selection (minimal tokens)
 * Stage 2: Send full definitions of selected functions only
 *
 * This solves:
 * - Token limit issues (200k max)
 * - Typo handling (Claude understands context)
 * - Multi-turn conversations
 * - Performance with caching
 */

const Anthropic = require('@anthropic-ai/sdk');

class ClaudeTwoStageSelector {
  constructor() {
    this.anthropic = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Initialize Anthropic client
    const productionKMS = require('./productionKMS');
    const apiKey = await productionKMS.getInternalKey('ANTHROPIC_API_KEY');

    this.anthropic = new Anthropic({
      apiKey: apiKey
    });

    this.initialized = true;
    console.log('✅ Two-Stage Claude Selector initialized');
  }

  /**
   * Get all available function names from aiHelpers
   * Returns ALL ~1400 functions for Stage 1 selection
   */
  getAllFunctionNames() {
    // CACHE BUSTING: Clear the aiHelpers module cache to pick up newly added functions
    // This ensures the two-stage selector sees functions added via add-single-collection.js
    const aiHelpersPath = require.resolve('./utils/aiHelpers');
    delete require.cache[aiHelpersPath];

    // Get ALL function names from aiHelpers (fresh load after cache clear)
    const aiHelpers = require('./utils/aiHelpers');
    const allFunctions = aiHelpers.getAllPlatformFunctions('en', 'USA');

    // Extract plain names for validation
    const plainNames = allFunctions.map(f => {
      return typeof f === 'string' ? f : f.name;
    });

    // CRITICAL FIX: Include short descriptions to help Claude distinguish similar functions
    // e.g., "getConsultationDetails" vs "getConsultationNotes" - names alone are too similar!
    // Format: "functionName - short description" for better function selection
    const namesWithDescriptions = allFunctions.map(f => {
      const name = typeof f === 'string' ? f : f.name;
      // Get short description from aiHelpers
      const shortDesc = aiHelpers.getShortDescription(name, false); // false = English
      // If description exists and is different from the name, include it
      if (shortDesc && shortDesc !== name) {
        return `${name} - ${shortDesc}`;
      }
      return name;
    });

    console.log(`📋 Two-Stage Selector: Loaded ${plainNames.length} function names with descriptions for Stage 1`);
    console.log(`⚡ EFFICIENCY: Using name + short description format for better function selection`);
    return {
      namesWithDescriptions: namesWithDescriptions,  // Names with descriptions for Claude
      plainNames: plainNames  // Plain names for validation
    };
  }

 
  /**
   * Stage 1: Ask Claude to select relevant function names
   * Uses conversation history ONLY to determine which functions are needed
   * Artifact context is handled separately in the main conversation
   */
  async selectFunctionNames(messages, context = {}) {
    if (!this.initialized) await this.initialize();

    // DISABLED: Fast-path optimization was causing false positives
    // Problem: "Yes please do" triggered analysis question regex, blocked medication fetch
    // Solution: Let Claude selector handle ALL requests - it's smarter about context

    // NO CACHING - Every query is unique and context matters
    // Caching function selection causes stale results and wrong function selection
    console.log('🔄 NO CACHE: Performing fresh function selection for this query');

    // Get all available function names and descriptions
    const functionData = this.getAllFunctionNames();
    const allFunctionNames = functionData.namesWithDescriptions;
    const plainNames = functionData.plainNames;

    try {
      // Build system prompt with function list (cached) and instructions (not cached)
      const functionListPrompt = `Available functions (descriptive names):
${allFunctionNames.join('\n')}`;

      // Add ARTIFACT CONTEXT to help Claude understand what data is currently visible
      let contextInfo = '';
      if (context.artifactContext) {
        contextInfo = `\n\nCONTEXT: Doctor is currently viewing ${context.artifactContext.category} data in the artifact panel for the patient.`;
        if (context.patientName) {
          contextInfo += ` Patient: ${context.patientName}`;
        }
        console.log(`📍 Artifact context available:`, contextInfo);
      }

      // Add UPLOAD CONTEXT - CRITICAL for document analysis vs patient CSV import
      if (context.uploadId) {
        // Check CSV type from header inspection (not filename!)
        const fileNames = context.fileNames || [];
        const csvType = context.csvType; // 'patients', 'users', 'error', or null
        const csvError = context.csvError; // Error details if csvType === 'error'
        console.log(`🔍 [ClaudeSelector] uploadId: ${context.uploadId}, fileNames:`, fileNames, `csvType: ${csvType}`);

        if (csvType === 'error') {
          // CSV has errors - DO NOT select any import function, return empty to respond with error
          console.log(`❌ CSV Error detected: ${csvError?.error} - ${csvError?.message}`);
          contextInfo += `\n\n🚨 CSV FILE ERROR:\nuploadId: "${context.uploadId}"\nCSV File: ${fileNames.join(', ')}\n\nERROR: ${csvError?.message}\n\nDO NOT select any functions. Return an empty array [] so you can respond to the user with the error message and instructions to fix the CSV file.\n\n`;
        } else if (csvType === 'patients') {
          // Patient CSV Import - select importPatientsFromCSV
          contextInfo += `\n\n🔥 CRITICAL - PATIENT CSV IMPORT:\nuploadId: "${context.uploadId}"\nCSV File: ${fileNames.join(', ')}\n\nUser just uploaded a patient CSV file (detected by CSV headers). You MUST select:\nimportPatientsFromCSV\n\nThis will import all patients from the CSV into the database. Do NOT select analyzeUploadedDocuments for CSV files!\n\n`;
          console.log(`📋 Patient CSV detected (by headers): ${fileNames.join(', ')} - will select importPatientsFromCSV`);
        } else if (csvType === 'users') {
          // User CSV Import - select importUsersFromCSV
          contextInfo += `\n\n🔥 CRITICAL - USER CSV IMPORT:\nuploadId: "${context.uploadId}"\nCSV File: ${fileNames.join(', ')}\n\nUser just uploaded a user/staff CSV file (detected by CSV headers). You MUST select:\nimportUsersFromCSV\n\nThis will import all users from the CSV into the database. Do NOT select analyzeUploadedDocuments for CSV files!\n\n`;
          console.log(`📋 User CSV detected (by headers): ${fileNames.join(', ')} - will select importUsersFromCSV`);
        } else {
          // Regular document upload (PDF, etc.) - select analyzeUploadedDocuments
          contextInfo += `\n\n🔥 CRITICAL - PENDING DOCUMENT UPLOAD:\nuploadId: "${context.uploadId}"\n\nUser just uploaded a document. If they say "analyze", "process", or "extract data", you MUST select:\nanalyzeUploadedDocuments\n\nIMPORTANT: The uploadId is already provided in context. The batch analysis will automatically extract patient information FROM the document itself. DO NOT ask the user for patient name/ID - just select analyzeUploadedDocuments!\n\n`;
          console.log(`📎 Upload context added: ${context.uploadId} (type: ${csvType || 'document'})`);
        }
      }

      // Add PREVIOUS ACTIONS context - helps with "do it all" requests
      let previousActionsContext = '';
      if (context.previousActions && context.previousActions.length > 0) {
        previousActionsContext = `\n\n🔥 PREVIOUS ACTIONS CONTEXT:\nThe user previously asked about these capabilities:\n`;
        context.previousActions.forEach((action, i) => {
          previousActionsContext += `${i + 1}. ${action}\n`;
        });
        previousActionsContext += `\n**CRITICAL**: If the user says "do it all", "do them all", "apply these", "execute all", "do everything", or similar phrases:\n`;
        previousActionsContext += `- Return the function names needed to perform ALL the above actions\n`;
        previousActionsContext += `- Map each action to its corresponding function (e.g., "schedule appointment" → scheduleAppointment)\n`;
        previousActionsContext += `- DO NOT return empty array [] or ask for clarification\n\n`;
        console.log(`[ClaudeSelector] 📋 Added ${context.previousActions.length} previous actions to context`);
      }

      const instructionsPrompt = `${contextInfo}${previousActionsContext}

Instructions:
1. You have access to 1400+ medical functions - ALWAYS check if ANY function matches the request
2. Select ALL functions needed to complete the request (usually 1-5 functions)
3. **CRITICAL RULE**: Only return empty array [] if you've checked ALL 1400 functions and NONE are relevant
4. The artifact panel being open should NOT prevent you from selecting functions
5. **CRITICAL: "recommendations" or "recommendation" keyword ALWAYS requires ACTION functions** - even if viewing medical data
   - When user asks "What are your recommendations?", "Your recommendations?", "Recommendations?" → SELECT ACTION FUNCTIONS
   - When user says "Apply your recommendations" or "Apply this" → SELECT PRESCRIPTION/ORDER/SCHEDULING FUNCTIONS
   - This is medical decision-making WITH EXECUTION, NOT just analysis
   - Look for: recommend, recommendation, recommendations, suggest, suggestion, treatment plan, plan, therapy, intervention, apply, prescribe, order, schedule
   - NEVER just return getCollectionsWithData for "Apply" requests - find the specific action functions needed

FUNCTION SELECTION PRIORITY (regardless of artifact panel state):

1. **DATA REQUESTS** → Always SELECT the specific function
   - Examples: "Show vital signs", "Show medications", "Get allergies", "Show diagnoses", "Check lab results"
   - Keywords: show, get, display, view, check, pull up, retrieve, fetch, find
   - Rule: If asking for ANY medical data → Search the 1400 functions for the appropriate getX function
   - ALWAYS execute the function even if similar data is visible
   - **⭐ MULTI-WORD PHRASE MATCHING:** When user query contains multi-word phrases (e.g., "medication recommendations"), prioritize functions that match THE COMPLETE PHRASE over partial word matches
     • "medication recommendations" → getMedicationRecommendations (NOT getMedications)
     • "doctor medication" → getDoctorsMedicationRecommendations (NOT getMedications)
     • "therapy recommendations" → getMedicationRecommendations
     • Look for function names that combine BOTH words in the user's phrase

2. **ACTION/IMPLEMENTATION** → SELECT ACTION FUNCTIONS
   - Examples: "Apply this", "Create a plan", "Add medication", "Prescribe", "Order", "Schedule", "What are your recommendations?"
   - Keywords: apply, create, add, prescribe, order, schedule, recommend, implement, update, modify
   - Select appropriate action functions: prescribeMedication, orderLabTests, createImagingOrders, scheduleFollowUp
   - DO NOT select getCollectionsWithData - go straight to specific ACTION functions

3. **CALCULATIONS/ANALYSIS WITH TOOLS** → SELECT if tool exists
   - Examples: "Calculate BMI", "Check drug interactions", "Assess risk", "Score this"
   - Rule: If there's a function that can compute/analyze → SELECT it (e.g., calculateBMI, checkDrugInteractions)

4. **NAVIGATION** → Use getCollectionsWithData
   - Examples: "Go back", "Show categories", "List all data", "What else do we have?"
   - Rule: If asking for overview/categories → SELECT getCollectionsWithData

5. **PURE CONVERSATIONAL** → Return [] ONLY as last resort
   - Examples: "Hello", "Thanks", "Good morning", "Tell me about diabetes" (general info, not patient-specific)
   - Rule: ONLY return [] if absolutely NO function from 1400+ can help
   - Even for analytical questions, check if there are specialized analysis functions first

CRITICAL PATIENT LOOKUP RULE:
4. **ALWAYS include searchPatientsByName FIRST** when:
   - User mentions a patient by name AND wants to perform ANY action
   - User says "Apply your recommendations" while viewing patient data in artifact panel
   - User wants to: Create/order/add/prescribe anything for the patient
   - User wants to: Update/modify/change patient data
   - User wants to: Schedule/manage appointments
   - User wants to: Execute/implement recommendations
   EXCEPTION: Skip searchPatientsByName ONLY if the conversation already has the patient ID from a previous search in the same session.

SPECIFIC RULES:
5. If user asks about appointments/schedule for a patient by name, select BOTH:
   - searchPatientsByName (to find the patient)
   - getAppointments (to check their schedule)
6. If user asks for details about a patient by name, select BOTH:
   - searchPatientsByName (to find the patient)
   - getPatientDetails (to get their information)
7. **CRITICAL DISTINCTION - Medical Data vs Collections List:**
   - If user asks "what medical data exists", "what collections", "list available data", "what do we have for this patient":
     → Use getCollectionsWithData (shows list of ALL collections with document counts + function names)
   - **If user asks for RECOMMENDATIONS after viewing medical data** (e.g., "What are your recommendations?", "Your recommendations?", "Recommendations for this?"):
     → FLOW: searchPatientsByName → getCollectionsWithData → Claude sees functionNames for each collection
     → Claude then calls appropriate functions to gather data and provide medical recommendations
     → This is MEDICAL DECISION-MAKING mode, not just analysis
   - If user asks to "check/review/analyze patient data", "give recommendations", "assess patient":
     → FLOW: searchPatientsByName → getCollectionsWithData → Claude sees functionNames for each collection
     → Claude then calls direct functions (getPrescriptions, getMedications, getAllergies, getLabResults, etc.)
     → Claude analyzes data and provides recommendations
   - Example: "show Helen's medications" → searchPatientsByName + call getMedications directly
   - Example: "what data do we have for Helen" → searchPatientsByName + getCollectionsWithData
   - Example: "Check Helen's data review her prescriptions give recommendation" → searchPatientsByName + getCollectionsWithData + Claude calls getPrescriptions, getMedications, getAllergies
8. If user asks for PENDING/ORDERED imaging tests or imaging orders, select:
   - getImagingOrders (shows pending imaging that hasn't been done yet, status='ordered')
   - NOT getImagingReports (which shows completed imaging with results)
9. If user asks to ORDER/CREATE imaging for a patient by name, select BOTH:
   - searchPatientsByName (to find the patient's ID first)
   - orderImaging (to create the imaging order using the patient ID)
10. If user asks to DELETE, REMOVE, or REVOKE a role from themselves or someone else, select:
   - removeUserRoleFromAccount (for role deletion/removal)
11. If user asks to ADD or GRANT a role to themselves or someone else, select:
   - addUserRoleToAccount (for role addition)
12. If user asks to update/change/modify their own role or someone's role, select:
   - changeUserRole (for role replacement/modification)
13. If user asks to add permissions or update user access, select:
   - updateUserPermissions or changeUserRole depending on context
14. **ALLERGY-SPECIFIC RULE - Use specific functions ONLY when explicitly requested:**
   - Use getAllergies for "show allergies", "what allergies", "patient allergies", "list allergies" → Displays merged document with severity grouping
   - Use getAllergiesAssessments ONLY if user explicitly asks for "allergy assessments", "allergy test results", "allergy lab tests", "skin prick tests", "specific IgE tests"
   - DO NOT confuse "allergies" (generic list) with "allergy assessments" (specific test results)
15. If pronouns like "she", "he", "her", "my", "me" are used, consider the context
16. For typos or unclear text, use your best judgment based on context
17. **ACTION WORDS ALWAYS REQUIRE FUNCTIONS** - If user requests action with these keywords, ALWAYS select appropriate functions:
    - "Apply" (apply recommendations, apply treatment, apply plan) → Select actionable functions for that domain
    - "Create" (create prescription, create appointment, create plan) → Select creation/ordering functions
    - "Add" (add medication, add patient, add appointment) → Select creation functions
    - "Update" (update medication, update diagnosis, update appointment) → Select update functions
    - "Generate" (generate report, generate plan) → Select generation functions
    - "Order" (order imaging, order labs, order test) → Select ordering functions
    - "Schedule" (schedule appointment, schedule follow-up) → Select appointment creation functions
    - "Implement" (implement recommendations, implement plan) → Select action functions related to the recommendation domain
    - "Prescribe" (prescribe medication, prescribe therapy) → Select prescription creation functions
    - These keywords OVERRIDE the "viewing artifact" rule - even if viewing data, user wants ACTION not just analysis
18. **CRITICAL COLLECTION NAMING DISTINCTION** - When selecting medical functions, distinguish between primary collections and historical record collections:
    - **PRIMARY COLLECTIONS** (singular or simple form): Use these for current/active medical assessments and data
      • Examples: getPrognosis, getRiskFactors, getFamilyHistory, getDiagnosis, getAssessmentPlans
      • Pattern: Function name matches the primary medical concept (prognosis, risk_factors, family_history)
      • Use when: User asks for "prognosis", "risk factors", "family history", "assessment", etc.
    - **HISTORICAL RECORD COLLECTIONS** (with "_records" suffix): Use these ONLY when explicitly asking for historical/archived records
      • Examples: getPrognosisRecords, getRiskFactorRecords, getFamilyHistoryRecords
      • Pattern: Function name ends with "Records" indicating historical/archived data
      • Use when: User specifically asks for "prognosis records", "historical prognosis", "archived prognosis"
    - **RULE**: When user asks for "prognosis" or "show prognosis" → SELECT getPrognosis (NOT getPrognosisRecords)
    - **RULE**: When user asks for "prognosis records" or "historical prognosis" → SELECT getPrognosisRecords
    - **APPLIES TO ALL COLLECTIONS**: This pattern applies to ANY collection with both forms (singular vs "_records")
19. **SIMILAR-SOUNDING COLLECTION DISAMBIGUATION** - When multiple collections share a common prefix, select the EXACT match:
    - "hospital course" or "hospital_course" → getHospitalCourse (NOT getHospitalDischargeSummaries, NOT getHospitalAdmissionNotes)
    - "hospital discharge" or "discharge summaries" → getHospitalDischargeSummaries
    - "hospital admission" or "admission notes" → getHospitalAdmissionNotes
    - "hospital transfer" or "transfer notes" → getHospitalTransferNotes
    - "follow up appointments" or "follow_up_appointments" → getFollowUpAppointments
    - **RULE**: Match the user's EXACT words to the function name. "hospital course" = getHospitalCourse, NOT a combination of discharge + admission functions.
    - **RULE**: Do NOT substitute multiple related functions when a single EXACT-MATCH function exists.

CRITICAL OUTPUT FORMAT:
- You MUST output ONLY a valid JSON array
- DO NOT add explanations, commentary, or text before/after the JSON
- If you want to explain something, DON'T - just output the JSON array
- Empty array example: []
- Functions example: ["searchPatientsByName", "getMedications"]

CRITICAL EXAMPLES:

User asks: "What are your recommendations?" (after viewing lab results in artifact panel)
→ Response: ["searchPatientsByName", "prescribeMedication", "scheduleFollowUp"]
→ NOT: [] (empty - this is WRONG for recommendations)
→ NOT: ["getCollectionsWithData"] (this is WRONG - need ACTION functions)

User asks: "Apply your recommendations"
→ Response: ["searchPatientsByName", "prescribeMedication", "orderLabTests", "scheduleFollowUp"]
→ NOT: [] (empty - WRONG)
→ NOT: ["getCollectionsWithData"] (WRONG - need specific action functions)

User asks: "What do these results mean?" (analytical question about visible data)
→ Response: []
→ Claude analyzes what's already visible

Example responses:
[]
["searchPatientsByName", "getPatientDetails"]
["getPatientDetailedInformation", "getPatientUpcomingAppointments", "getPatientCurrentMedications"]`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-5',  // Claude Sonnet 5 - Best for tool selection from large libraries
        max_tokens: 1024,  // Enough for function name list
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system: [
          {
            type: 'text',
            text: `You are a FUNCTION NAME SELECTOR. Your task is PURELY MECHANICAL.

CRITICAL RULES:
1. You MUST output ONLY a valid JSON array of function names
2. NEVER write explanations, commentary, or conversational text
3. NEVER simulate execution (no "Executing..." messages)
4. NEVER role-play or provide context
5. If the user says "do X" or "do them all", identify which FUNCTION NAMES are needed for X
6. If unsure, return empty array [] - NEVER return text

VALID OUTPUT EXAMPLES:
- []
- ["searchPatientsByName"]
- ["addVitalSigns", "orderLabTest", "createPrescription"]

INVALID OUTPUT (NEVER DO THIS):
- "Let me execute those functions..."
- "Executing addVitalSigns..."
- Any text that is not a JSON array

Your ENTIRE response must be parseable by JSON.parse(). Nothing else.`,
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text: functionListPrompt,
            cache_control: { type: 'ephemeral' }  // Cache the function list
          },
          {
            type: 'text',
            text: instructionsPrompt
            // Don't cache instructions - they're small and may include artifact context
          }
        ],
        messages: messages
          .filter(msg => {
            // Filter out messages with empty content
            // Claude API requires all messages (except optional final assistant) to have non-empty content
            if (!msg.content || (typeof msg.content === 'string' && msg.content.trim() === '')) {
              console.log(`⚠️ Filtered out message with empty content (role: ${msg.role})`);
              return false;
            }
            return true;
          })
          .map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
      });

      // Parse the response to get function names
      let content = response.content[0].text;
      console.log('🔍 RAW Claude response:', content);

      // Strip markdown code fences if present
      const strippedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let selectedNames = [];

      try {
        // Try to parse as JSON
        selectedNames = JSON.parse(strippedContent);
        console.log('✅ Parsed as JSON:', selectedNames);
      } catch (e) {
        console.log('⚠️ Not valid JSON, extracting function names');
        // If not valid JSON, try to extract function names
        const matches = strippedContent.match(/"([^"]+)"/g);
        if (matches) {
          selectedNames = matches.map(m => m.replace(/"/g, ''));
          console.log('✅ Extracted from quotes:', selectedNames);
        } else {
          console.log('❌ Could not extract any function names');
          // CRITICAL: If no function names found, this is a conversational response
          // Return the raw answer with a special flag so Stage 2 can use it directly
          console.log('💬 CONVERSATIONAL MODE: Claude provided analysis instead of function selection');
          return {
            isConversational: true,
            conversationalResponse: content
          };
        }
      }

      // Validate that these are actual function names (extract from "name - description" format if needed)
      selectedNames = selectedNames.map(name => {
        // If Claude returned "functionName - description", extract just the name
        const match = name.match(/^([a-zA-Z0-9_]+)\s*-/);
        return match ? match[1] : name;
      }).filter(name => plainNames.includes(name));

      // Remove duplicates (Claude sometimes returns the same function twice)
      const uniqueSelectedNames = [...new Set(selectedNames)];

      console.log(`🎯 Stage 1: Claude selected ${uniqueSelectedNames.length} functions`);
      console.log(`📋 Selected: ${uniqueSelectedNames.join(', ')}`);

      // NO CACHING - removed to prevent stale function selection
      return uniqueSelectedNames;
    } catch (error) {
      // ========================================
      // COMPREHENSIVE ANTHROPIC SDK ERROR HANDLING
      // ========================================

      // Check for network connectivity errors (no internet connection)
      const networkErrorCodes = ['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH', 'ECONNREFUSED', 'ECONNRESET'];
      const isNetworkError =
        networkErrorCodes.includes(error.code) ||
        networkErrorCodes.includes(error.cause?.code) ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('getaddrinfo') ||
        error.constructor?.name === 'APIConnectionError' ||
        error.constructor?.name === 'APIConnectionTimeoutError';

      if (isNetworkError) {
        const errorCode = error.cause?.code || error.code || 'UNKNOWN';
        const errorMsg = error.cause?.message || error.message || 'Unknown network error';

        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ NETWORK CONNECTION ERROR');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Function selection (Stage 1)');
        console.error('   Service: Anthropic API (api.anthropic.com)');
        console.error(`   Error Code: ${errorCode}`);
        console.error(`   Error Type: ${error.constructor?.name || 'Error'}`);
        console.error(`   Details: ${errorMsg}`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Throw a user-friendly error that will be caught by the route handler
        const networkError = new Error('Unable to process request: No internet connection available. Please check your network connection and try again.');
        networkError.code = 'NO_INTERNET_CONNECTION';
        networkError.isNetworkError = true;
        networkError.originalError = errorCode;
        throw networkError;
      }

      // Check for Anthropic API-specific errors
      const errorType = error.constructor?.name;

      if (errorType === 'AuthenticationError') {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ AUTHENTICATION ERROR (401)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Function selection (Stage 1)');
        console.error('   Status: Invalid or missing API key');
        console.error(`   Request ID: ${error.requestID || 'N/A'}`);
        console.error(`   Message: ${error.message}`);
        console.error('   Action: Check ANTHROPIC_API_KEY environment variable');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const authError = new Error('Unable to process request: API authentication failed. Please contact system administrator.');
        authError.code = 'AUTHENTICATION_ERROR';
        authError.status = 401;
        throw authError;
      }

      if (errorType === 'RateLimitError') {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ RATE LIMIT ERROR (429)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Function selection (Stage 1)');
        console.error('   Status: Too many requests to Anthropic API');
        console.error(`   Request ID: ${error.requestID || 'N/A'}`);
        console.error(`   Message: ${error.message}`);
        console.error('   Action: Wait a moment and try again');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const rateLimitError = new Error('Service is currently busy. Please wait a moment and try again.');
        rateLimitError.code = 'RATE_LIMIT_ERROR';
        rateLimitError.status = 429;
        throw rateLimitError;
      }

      if (errorType === 'InternalServerError') {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ANTHROPIC API SERVER ERROR (500+)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Function selection (Stage 1)');
        console.error(`   Status: ${error.status || '500'}`);
        console.error(`   Request ID: ${error.requestID || 'N/A'}`);
        console.error(`   Message: ${error.message}`);
        console.error('   Action: Anthropic API is experiencing issues');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const serverError = new Error('AI service is temporarily unavailable. Please try again in a few moments.');
        serverError.code = 'API_SERVER_ERROR';
        serverError.status = error.status;
        throw serverError;
      }

      if (errorType === 'BadRequestError') {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ BAD REQUEST ERROR (400)');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   Stage: Function selection (Stage 1)');
        console.error(`   Request ID: ${error.requestID || 'N/A'}`);
        console.error(`   Message: ${error.message}`);
        console.error('   Action: Invalid request format - check request parameters');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      // For all other errors, log with less detail and return empty array
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ STAGE 1 SELECTION FAILED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`   Error Type: ${errorType || error.constructor?.name || 'Unknown'}`);
      console.error(`   Message: ${error.message || 'Unknown error'}`);
      console.error(`   Status: ${error.status || 'N/A'}`);
      console.error(`   Request ID: ${error.requestID || 'N/A'}`);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️ Returning empty function list - chat will show error to user');
      return [];
    }
  }

  /**
   * Stage 2: Get full function definitions for selected names
   */
  async getSelectedFunctions(selectedNames) {
    const functionRegistry = require('./functionRegistry');

    // Ensure Function Registry is initialized
    if (!functionRegistry.initialized) {
      console.log('⚠️ Function Registry not initialized, initializing now...');
      await functionRegistry.initialize();
    }

    console.log(`🔄 Stage 2: Getting definitions for: ${selectedNames.join(', ')}`);

    // Get full function definitions from registry - this is O(1) lookup per function
    const functions = functionRegistry.getFunctions(selectedNames, 'claude');

    // If some functions not found, log warning but continue with what we have
    if (functions.length < selectedNames.length) {
      const foundNames = functions.map(f => f.name);
      const missingNames = selectedNames.filter(name => !foundNames.includes(name));
      console.warn(`⚠️ Some functions not found in registry: ${missingNames.join(', ')}`);
    }

    // CRITICAL: Never fallback to loading ALL functions
    // Return only the functions we found in the registry
    console.log(`✅ Retrieved ${functions.length}/${selectedNames.length} function definitions`);

    // Log input_examples status for verification (November 2025)
    const withExamples = functions.filter(f => f.input_examples && f.input_examples.length > 0);
    console.log(`📝 input_examples: ${withExamples.length}/${functions.length} tools have examples`);
    if (withExamples.length > 0) {
      console.log(`   Tools with examples: ${withExamples.map(f => f.name).join(', ')}`);
    }

    return functions;
  }

  /**
   * Normalize messages for cache key generation
   */
  normalizeMessagesForCache(messages) {
    const crypto = require('crypto');

    // Extract key information from messages
    const normalizedMessages = messages.map(msg => {
      let content = msg.content || '';

      // Convert to lowercase and remove extra spaces
      content = content.toLowerCase().trim().replace(/\s+/g, ' ');

      // Remove common filler words
      const fillerWords = ['please', 'can you', 'could you', 'would you', 'kindly', 'i need', 'i want', 'show me', 'give me'];
      fillerWords.forEach(filler => {
        content = content.replace(new RegExp(`\\b${filler}\\b`, 'gi'), '');
      });

      // Normalize common synonyms
      const synonyms = {
        'patient': ['patients', 'patient\'s', 'pts', 'pt'],
        'appointment': ['appointments', 'appt', 'schedule', 'booking'],
        'medication': ['medications', 'meds', 'drugs', 'prescription', 'rx'],
        'doctor': ['physician', 'provider', 'dr', 'doc'],
        'list': ['show', 'display', 'view', 'get'],
        'create': ['add', 'new', 'make', 'schedule'],
        'delete': ['remove', 'cancel', 'revoke'],
        'update': ['change', 'modify', 'edit']
      };

      for (const [standard, variants] of Object.entries(synonyms)) {
        variants.forEach(variant => {
          content = content.replace(new RegExp(`\\b${variant}\\b`, 'gi'), standard);
        });
      }

      return {
        role: msg.role,
        content: content.trim()
      };
    });

    // Create hash from normalized messages
    const messageString = JSON.stringify(normalizedMessages);
    return crypto.createHash('md5').update(messageString).digest('hex');
  }

  /**
   * Complete two-stage selection process
   */
  async selectFunctions(messages, context = {}) {
    console.log('🎭 TWO-STAGE FUNCTION SELECTION STARTING');

    // Stage 1: Select function names
    const startStage1 = Date.now();
    const selectedNames = await this.selectFunctionNames(messages, context);
    const stage1Time = Date.now() - startStage1;
    console.log(`⏱️ Stage 1 completed in ${stage1Time}ms`);

    // Check if this is a conversational response (no functions selected)
    if (selectedNames && typeof selectedNames === 'object' && selectedNames.isConversational) {
      console.log('✅ Conversational response detected, skipping Stage 2');
      // Return the conversational response wrapped in a way the caller expects
      return {
        isConversational: true,
        conversationalResponse: selectedNames.conversationalResponse
      };
    }

    // Always inject requestPermission so users can request permissions after PERMISSION_DENIED
    if (Array.isArray(selectedNames) && !selectedNames.includes('requestPermission')) {
      selectedNames.push('requestPermission');
    }

    // Stage 2: Get full definitions
    const startStage2 = Date.now();
    const functions = await this.getSelectedFunctions(selectedNames);
    const stage2Time = Date.now() - startStage2;
    console.log(`⏱️ Stage 2 completed in ${stage2Time}ms`);

    const totalTime = stage1Time + stage2Time;
    console.log(`📊 Total selection time: ${totalTime}ms`);
    console.log(`💾 Token usage: ~${selectedNames.length * 20} tokens (vs ~210,000 for all functions)`);

    return functions;
  }

}

module.exports = new ClaudeTwoStageSelector();