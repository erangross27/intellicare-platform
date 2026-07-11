const { ObjectId } = require('mongodb');
const Anthropic = require('@anthropic-ai/sdk');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const roleModel = require('../config/roles');

class AuthAIService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.anthropic = null; // Will be initialized after service initialization
    
    // Response cache for common queries (5 minute TTL)
    this.responseCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Track usage statistics for monitoring
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      apiCalls: 0,
      promptCacheTokensSaved: 0,
      estimatedCostSavings: 0
    };
    
    // Define available functions for authentication
    this.functions = [
      {
        name: 'createNewPractice',
        description: 'Create a brand new practice with admin user',
        parameters: {
          type: 'object',
          properties: {
            practiceName: {
              type: 'string',
              description: 'The name of the practice (can be in any language)'
            },
            subdomain: { 
              type: 'string', 
              description: 'OPTIONAL - System auto-generates if not provided. Do NOT ask user for this.' 
            },
            adminFirstName: {
              type: 'string',
              description: 'First name of the practice administrator'
            },
            adminLastName: {
              type: 'string',
              description: 'Last name of the practice administrator'
            },
            adminEmail: {
              type: 'string',
              description: 'Email address of the practice administrator'
            },
            adminPhone: {
              type: 'string',
              description: 'Phone number of the practice administrator (with country code, e.g., +972-50-123-4567)'
            },
            city: {
              type: 'string',
              description: 'City where the practice is located'
            },
            state: {
              type: 'string',
              description: 'State/Province (required for USA practices, optional for Israel)'
            },
            country: {
              type: 'string',
              description: 'Country where the practice is located (e.g., Israel, USA)'
            },
            website: {
              type: 'string',
              description: 'Website URL of the practice (optional, from Google Places if available)'
            },
            streetAddress: {
              type: 'string',
              description: 'Street address of the practice (from Google Places if available)'
            },
            zipCode: {
              type: 'string',
              description: 'Postal/ZIP code of the practice (from Google Places if available)'
            }
          },
          required: ['practiceName', 'adminFirstName', 'adminLastName', 'adminEmail', 'adminPhone', 'city', 'country']
        }
      },
      {
        name: 'loginUser',
        description: 'Login an existing user - ONLY call this AFTER user provides their actual email address. NEVER use placeholder values.',
        parameters: {
          type: 'object',
          properties: {
            email: { 
              type: 'string', 
              description: 'The actual email address provided by the user (not a placeholder)' 
            },
            practiceSubdomain: { 
              type: 'string', 
              description: 'Optional - The subdomain of the practice to login to (only needed if user has multiple practices)' 
            }
          },
          required: ['email']
        }
      },
      {
        name: 'signupUser',
        description: 'Create a new user account at an existing practice',
        parameters: {
          type: 'object',
          properties: {
            practiceSubdomain: {
              type: 'string',
              description: 'The subdomain of the existing practice to join'
            },
            firstName: { 
              type: 'string', 
              description: 'First name of the new user' 
            },
            lastName: { 
              type: 'string', 
              description: 'Last name of the new user' 
            },
            email: { 
              type: 'string', 
              description: 'Email address of the new user' 
            }
          },
          required: ['practiceSubdomain', 'firstName', 'lastName', 'email']
        }
      },
      {
        name: 'listAvailablePractices',
        description: 'Show a list of available practices that users can join',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'lookupLocation',
        description: 'Smart lookup for business or city - finds complete address, phone, and location details',
        parameters: {
          type: 'object',
          properties: {
            query: { 
              type: 'string', 
              description: 'Business name (e.g., "Stanford Medical Center") or city name (e.g., "San Jose")' 
            }
          },
          required: ['query']
        }
      },
      {
        name: 'resendEmailVerification',
        description: 'Resend email verification to a user',
        parameters: {
          type: 'object',
          properties: {
            email: { 
              type: 'string', 
              description: 'Email address to resend verification to' 
            },
            reason: { 
              type: 'string', 
              description: 'Reason for resending (optional)' 
            }
          },
          required: ['email']
        }
      },
      {
        name: 'verifyOTPCode',
        description: 'Verify a 6-digit OTP code to complete login - ONLY call this when user provides a 6-digit code',
        parameters: {
          type: 'object',
          properties: {
            code: { 
              type: 'string', 
              description: 'The 6-digit verification code provided by the user' 
            },
            email: { 
              type: 'string', 
              description: 'The email address the code was sent to (from previous loginUser call)' 
            }
          },
          required: ['code', 'email']
        }
      },
      {
        name: 'verifyEmailOTP',
        description: 'Verify a 6-digit OTP code for email verification after practice creation - ONLY call this when user provides a 6-digit code after createNewPractice',
        parameters: {
          type: 'object',
          properties: {
            code: { 
              type: 'string', 
              description: 'The 6-digit verification code provided by the user' 
            },
            email: { 
              type: 'string', 
              description: 'The admin email address from the createNewPractice call' 
            },
            subdomain: {
              type: 'string',
              description: 'The practice subdomain from the createNewPractice call'
            }
          },
          required: ['code', 'email', 'subdomain']
        }
      }
    ];

    // System prompt for Claude - keep it concise and user-friendly
    this.systemPrompt = `You are IntelliCare's assistant helping users get started.

CRITICAL LANGUAGE RULE: Respond ONLY in the language specified in the API call. If language='he' respond ONLY in Hebrew. If language='en' respond ONLY in English. NEVER mix languages.

TERMINOLOGY: In English, always use "practice". In Hebrew, use "מרפאה".

BE CONCISE: Skip pleasantries when user has made a clear choice. Get straight to the point.

UNDERSTANDING USER INTENT:
- If user says: "new practice", "create practice", "set up practice", "open practice", "start practice", "I want to create", "help me create" → They want to CREATE a new practice
- If user says: "login", "sign in", "existing account", "already have" → They want to LOGIN - MUST ASK "What's your email address?" BEFORE calling any function
- If user says: "join", "sign up", "register", "new user" → They want to SIGNUP to existing practice
- If user says: "didn't receive email", "resend verification", "email not received", "send again", "לא קיבלתי אימייל", "שלח שוב" → They want to RESEND email verification

CRITICAL RULE: NEVER call any function with placeholder values. Always get real data from the user first.

LOGIN FLOW - EMAIL FIRST:
1. When user wants to login, ALWAYS ASK FOR EMAIL FIRST - DO NOT call loginUser without a real email
2. NEVER use placeholder values like "user_email_needed" or "email_needed"
3. Only after user provides their actual email, call loginUser with the real email
4. If they have one practice → Auto-send OTP code
5. If they have multiple practices → Show list and ask which one
6. If no account found → Suggest registration

OTP VERIFICATION FLOW:
1. After loginUser sends OTP code, user will provide a 6-digit code
2. When user provides a 6-digit number (like "123456"), call verifyOTPCode immediately
3. Pass the code exactly as provided and the email from the previous loginUser call
4. IMPORTANT: Store the email from loginUser response to use in verifyOTPCode

EMAIL VERIFICATION OTP FLOW:
1. After createNewPractice sends verification OTP code, user will provide a 6-digit code
2. When user provides a 6-digit number after practice creation, call verifyEmailOTP immediately
3. Pass the code exactly as provided and the email from the previous createNewPractice call
4. IMPORTANT: Store the email and subdomain from createNewPractice response to use in verifyEmailOTP

Your approach:
1. Be direct and efficient - ONE STEP AT A TIME
2. When user says "New Practice", DON'T say "Great! I'd be happy to help..." - JUST ASK DIRECTLY: "What's the name of your practice?" (English) or "מה שם המרפאה?" (Hebrew)
3. Then collect each piece of information step by step:
   - Practice name first (IMPORTANT: If they give you a real business name like "Stanford Medical Center", use lookupLocation IMMEDIATELY to find all details!)
   - When lookupLocation returns business details:
     * Show ALL the details (address, phone, website)
     * Ask for confirmation
     * When user confirms the details (in any way that indicates agreement):
       - DO NOT call lookupLocation again - you already have the data!
       - DO NOT repeat the location info
       - Move to the next step: asking for administrator details
       - Remember you already have city, state, phone, website from the business
     * If user indicates they want changes, help them modify the details
   - **NEVER ASK FOR SUBDOMAIN** - the system will auto-generate it from the practice name
   - After location confirmation, ask: "Who will be the administrator? Please provide their name and email."
     * Users can provide just name, or "FirstName LastName email@domain.com" all at once
     * Parse intelligently - extract firstName, lastName, and email from their response
     * If they only give name, ask for email next
     * If they give everything, move to phone
   - Then phone - BE SMART HERE:
     * If you already have phone from business lookup, ask: "Should I use the practice phone (XXX) XXX-XXXX for the admin account, or would you prefer a different contact number?"
     * DO NOT say "I need your phone number" if you already have one - just ask which one to use
     * Only ask for phone number if you don't have one from business lookup
   - Then location - BE SMART HERE:
     * If they say a city name (like "San Jose"), use lookupLocation to find the state automatically
     * If they give a business name, use lookupLocation to get EVERYTHING (address, phone, website)
     * For USA: You'll get the state automatically, no need to ask separately
4. For country, be smart:
   - If phone starts with +972 or 05 → assume Israel
   - If phone starts with +1 → assume USA (MUST ask for state)
   - If speaking Hebrew → likely Israel
5. For USA practices: ALWAYS ask for the state (e.g., California, New York, Texas)
6. Once you have everything, confirm briefly and execute

Available functions:
- lookupLocation: Smart lookup for business or city (USE THIS when they mention any location or business name!)
- createNewPractice: Create new practice (use only after collecting ALL information - subdomain will be auto-generated)
- loginUser: Login to existing practice (sends OTP code)
- verifyOTPCode: Verify 6-digit code to complete login
- signupUser: Join existing practice
- resendEmailVerification: Resend verification email to a user (use when user asks to resend verification or didn't receive email)

CONVERSATION STATE TRACKING:
- After showing location details and user confirms → Ask for administrator details (name and email together)
- NEVER ask for subdomain - it will be auto-generated from the practice name
- Parse multiple fields from single response (e.g., "John Doe john@practice.com" → firstName, lastName, email)
- Track what info you already have from lookupLocation (city, state, phone, website, streetAddress, zipCode, etc.)
- Don't ask for information you already collected
- If you have practice phone from lookupLocation → Offer to use it or ask if they want a different number
- Admin phone can be different from practice phone (personal vs business)
- Use your judgment to understand when user is confirming vs requesting changes
- After user confirms location, proceed naturally to collecting subdomain
- NEVER repeat the location lookup after confirmation
- REMEMBER: When calling createNewPractice, include ALL data from Google Places (website, streetAddress, zipCode) if found

Remember: 
- Collect information STEP BY STEP, not all at once
- When user confirms something, MOVE FORWARD (don't repeat)
- Keep responses SHORT and friendly
- Guide users naturally through the process
- Only execute functions after confirmation`;
  }

  getCacheKey(message, language) {
    return `${language}:${message.toLowerCase().trim()}`;
  }
  
  getCachedResponse(key) {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log('📦 Using cached response for:', key.substring(0, 50));
      this.stats.cacheHits++;
      return cached.response;
    }
    return null;
  }
  
  setCachedResponse(key, response) {
    this.responseCache.set(key, {
      response,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.responseCache.size > 100) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }
  }

  async processMessage(message, language = 'en', conversationHistory = [], currentSubdomain = null) {
    try {
      // Ensure service is initialized
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.stats.totalRequests++;
      
      // Log subdomain if provided
      if (currentSubdomain) {
        console.log(`🏥 [Auth AI] Current subdomain context: ${currentSubdomain}`);
      }
      
      // Auto-detect Hebrew if not explicitly set
      if (language === 'en' && /[\u0590-\u05FF]/.test(message)) {
        language = 'he';
        console.log('🌐 Auto-detected Hebrew language from message content');
      }
      
      // Check cache for simple queries
      if (conversationHistory.length === 0) {
        const cacheKey = this.getCacheKey(message, language);
        const cached = this.getCachedResponse(cacheKey);
        if (cached) {
          return cached;
        }
      }
      
      this.stats.apiCalls++;
      
      console.log(`🤖 [Auth AI] Processing message (${language}): "${message.substring(0, 50)}..."`);
      
      // Build messages array for Claude
      const messages = [];
      
      // Add conversation history WITHOUT caching (messages can't be cached)
      if (conversationHistory.length > 0) {
        // Validate and clean conversation history
        for (const msg of conversationHistory) {
          // Skip invalid messages
          if (!msg.role || !msg.content) continue;
          
          // Ensure content is in correct format
          if (typeof msg.content === 'string') {
            messages.push({ role: msg.role, content: msg.content });
          } else if (Array.isArray(msg.content)) {
            messages.push({ role: msg.role, content: msg.content });
          } else if (msg.content.text) {
            messages.push({ role: msg.role, content: msg.content.text });
          } else {
            messages.push(msg);
          }
        }
      }
      
      // Add current user message
      messages.push({ role: 'user', content: message });

      // Prepare tools with cache control (each tool can be cached)
      const tools = this.functions.slice(0, 3).map(f => ({
        name: f.name,
        description: f.description,
        input_schema: f.parameters,
        cache_control: { type: 'ephemeral' }  // Cache first 3 tools
      })).concat(
        this.functions.slice(3).map(f => ({
          name: f.name,
          description: f.description,
          input_schema: f.parameters
        }))
      );

      // Call Claude with function definitions and prompt caching, with retry logic
      let response;
      let retryCount = 0;
      const maxRetries = 3;
      const baseDelay = 1000; // 1 second

      while (retryCount <= maxRetries) {
        try {
          console.log(`📡 [Auth AI] Calling Claude API (attempt ${retryCount + 1})...`);
          // Use direct API for auth (auth functions not in MCP yet)
          response = await this.anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 20000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        tool_choice: { type: 'auto' },  // Allow Claude to decide when to use tools
        // System prompt with cache_control (1st cache block) - INCLUDE LANGUAGE DIRECTIVE
        system: [
          {
            type: 'text',
            text: `CRITICAL LANGUAGE RULE: You MUST respond ONLY in ${language === 'he' ? 'Hebrew' : 'English'}. DO NOT provide bilingual responses. DO NOT use <hr> or any separator to show both languages.\n\n${this.systemPrompt}`,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: messages,
        // Tools with cache_control on first 3 (2nd, 3rd, 4th cache blocks)
        tools: tools
          });
          
          // Success - break out of retry loop
          console.log(`✅ [Auth AI] Claude API response received`);
          break;
          
        } catch (error) {
          // Handle 529 Overloaded error specifically
          if (error.status === 529) {
            console.warn(`⚠️ Claude API overloaded (attempt ${retryCount + 1}/${maxRetries + 1})`);
            
            if (retryCount < maxRetries) {
              // Exponential backoff with jitter
              const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
              console.log(`⏳ Retrying in ${Math.round(delay / 1000)}s...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              continue;
            } else {
              // Max retries reached - return fallback response
              console.error('❌ Claude API overloaded after all retries');
              
              // Return graceful error message to user
              return {
                success: false,
                message: language === 'he' 
                  ? 'השירות עמוס כרגע. אנא נסה שוב בעוד מספר דקות.'
                  : 'The service is currently overloaded. Please try again in a few minutes.',
                sessionId,
                error: 'SERVICE_OVERLOADED',
                retryAfter: 60 // Suggest retry after 60 seconds
              };
            }
          }
          
          // Handle other errors
          console.error(`❌ [Auth AI] Claude API error:`, {
            status: error.status,
            type: error.type || error.name,
            message: error.message,
            details: error.error?.message || error.response?.data || 'No additional details'
          });
          throw error;
        }
      }

      // Track cache usage from response
      if (response.usage) {
        console.log('🚀 Cache usage:', {
          cache_creation_tokens: response.usage.cache_creation_input_tokens || 0,
          cache_read_tokens: response.usage.cache_read_input_tokens || 0,
          regular_tokens: response.usage.input_tokens || 0,
          output_tokens: response.usage.output_tokens || 0
        });
        
        // Update stats
        if (response.usage.cache_read_input_tokens > 0) {
          this.stats.promptCacheTokensSaved += response.usage.cache_read_input_tokens;
          const costSaved = (response.usage.cache_read_input_tokens / 1000000) * 3 * 0.9; // $3/1M tokens, 90% savings
          this.stats.estimatedCostSavings += costSaved;
        }
      }

      // Check if Claude wants to use a function (can be anywhere in content array)
      console.log(`🔍 [Auth AI] Response type: ${response.content[0]?.type}`);
      
      // Look for tool_use in any part of the response
      const toolUse = response.content.find(item => item.type === 'tool_use');
      
      if (toolUse) {
        const functionName = toolUse.name;
        const functionArgs = toolUse.input;
        
        console.log(`🎯 [Auth AI] Function call: ${functionName}`, functionArgs);
        
        // Execute the function with language and subdomain parameters
        const result = await this.executeFunction(functionName, functionArgs, language, currentSubdomain);
        
        // Get any text response that came with the function call
        const textResponse = response.content.find(item => item.type === 'text');
        let textContent = textResponse?.text || '';
        
        // FILTER: Remove bilingual content if present
        if (textContent && (textContent.includes('<hr>') || textContent.includes('<hr/>'))) {
          console.log('⚠️ Filtering bilingual content from function response');
          const parts = textContent.split(/<hr\s*\/?>/);
          const hebrewPattern = /[\u0590-\u05FF]/;
          
          if (parts.length > 1) {
            if (language === 'he') {
              textContent = parts.find(p => hebrewPattern.test(p)) || parts[0];
            } else {
              textContent = parts.find(p => !hebrewPattern.test(p) || p.match(/[a-zA-Z]{10,}/)) || parts[0];
            }
            textContent = textContent.trim();
          }
        }
        
        const combinedMessage = textContent 
          ? `${textContent}\n\n${result.message}`
          : result.message;
        
        // Build proper conversation history for Claude
        // Simplify history - just track user messages and assistant responses
        const updatedHistory = [
          ...messages,
          { role: 'assistant', content: combinedMessage }
        ];
        
        // Special handling for lookupLocation - continue the conversation after location found
        if (functionName === 'lookupLocation' && result.success) {
          console.log(`📍 [Auth AI] Location found (${result.type}), preparing to continue...`);
          
          // Don't auto-continue - let the user confirm the location first
          // Just return the location details
          return {
            success: true,
            message: combinedMessage,
            functionCalled: functionName,
            functionResult: result,
            conversationHistory: updatedHistory,
            cacheStats: response.usage ? {
              cacheHit: (response.usage.cache_read_input_tokens || 0) > 0,
              tokensFromCache: response.usage.cache_read_input_tokens || 0,
              tokensCached: response.usage.cache_creation_input_tokens || 0,
              totalTokens: response.usage.input_tokens || 0
            } : null
          };
        }
        
        // Return both the function execution and Claude's response
        return {
          success: true,
          message: combinedMessage,
          functionCalled: functionName,
          functionResult: result,
          conversationHistory: updatedHistory,
          cacheStats: response.usage ? {
            cacheHit: (response.usage.cache_read_input_tokens || 0) > 0,
            tokensFromCache: response.usage.cache_read_input_tokens || 0,
            tokensCached: response.usage.cache_creation_input_tokens || 0,
            totalTokens: response.usage.input_tokens || 0
          } : null
        };
      }

      // Regular text response
      // Filter bilingual content from text response
      // NOTE: adaptive thinking (thinking: { type: 'adaptive' }) can emit a
      // `thinking` block at content[0], so we must locate the text block instead
      // of assuming index 0 is text (mirrors the tool_use path above). Otherwise
      // messageText becomes undefined and the client receives an empty message.
      const finalTextBlock = response.content.find(item => item.type === 'text');
      let messageText = finalTextBlock?.text || '';
      if (messageText && (messageText.includes('<hr>') || messageText.includes('<hr/>'))) {
        console.log('⚠️ Filtering bilingual content from text response');
        const parts = messageText.split(/<hr\s*\/?>/);
        const hebrewPattern = /[\u0590-\u05FF]/;
        
        if (parts.length > 1) {
          if (language === 'he') {
            messageText = parts.find(p => hebrewPattern.test(p)) || parts[0];
          } else {
            messageText = parts.find(p => !hebrewPattern.test(p) || p.match(/[a-zA-Z]{10,}/)) || parts[0];
          }
          messageText = messageText.trim();
        }
      }
      
      const result = {
        success: true,
        message: messageText,
        conversationHistory: [
          ...messages,
          { role: 'assistant', content: messageText }
        ],
        cacheStats: response.usage ? {
          cacheHit: (response.usage.cache_read_input_tokens || 0) > 0,
          tokensFromCache: response.usage.cache_read_input_tokens || 0,
          tokensCached: response.usage.cache_creation_input_tokens || 0,
          totalTokens: response.usage.input_tokens || 0
        } : null
      };
      
      // Cache simple responses
      if (conversationHistory.length === 0) {
        const cacheKey = this.getCacheKey(message, language);
        this.setCachedResponse(cacheKey, result);
      }
      
      return result;

    } catch (error) {
      console.error('❌ Auth AI Service error:', error);
      return {
        success: false,
        message: language === 'he' 
          ? 'מצטער, נתקלתי בבעיה. אנא נסה שוב.'
          : 'Sorry, I encountered an issue. Please try again.',
        error: error.message
      };
    }
  }

  async executeFunction(functionName, args, language = 'en', currentSubdomain = null) {
    console.log(`🤖 Executing function: ${functionName}`, args);
    if (currentSubdomain) {
      console.log(`🏥 Using subdomain context: ${currentSubdomain}`);
    }
    
    switch (functionName) {
      case 'createNewPractice':
        return await this.createNewPractice(args, language);
      
      case 'loginUser':
        return await this.loginUser(args, language, currentSubdomain);
      
      case 'verifyOTPCode':
        return await this.verifyOTPCode(args, language, currentSubdomain);
      
      case 'verifyEmailOTP':
        return await this.verifyEmailOTP(args, language, currentSubdomain);
      
      case 'signupUser':
        return await this.signupUser(args, language);
      
      case 'listAvailablePractices':
        return await this.listAvailablePractices();
      
      case 'checkPracticeExists':
        return await this.checkPracticeExists(args, language);
      
      case 'lookupLocation':
        return await this.lookupLocation(args, language);
      
      case 'resendEmailVerification':
        return await this.resendEmailVerification(args, language, currentSubdomain);
      
      default:
        return {
          success: false,
          message: `Unknown function: ${functionName}`
        };
    }
  }

  async createNewPractice({ practiceName, subdomain, adminFirstName, adminLastName, adminEmail, adminPhone, city, state, country, website, streetAddress, zipCode, openingHours }, language = 'en') {
    try {
      console.log(`📝 [createNewPractice] Input parameters:`, {
        practiceName,
        subdomain,
        city,
        state,
        country
      });

      // Auto-generate subdomain if not provided or if it's just the city name
      if (!subdomain || subdomain.toLowerCase() === city?.toLowerCase()) {
        console.log(`🤖 [createNewPractice] Subdomain empty or matches city, auto-generating...`);
        const subdomainResult = await this.generateSmartSubdomain(practiceName, city, language);
        subdomain = subdomainResult.subdomain;
        console.log(`✅ [createNewPractice] Auto-generated subdomain: "${subdomain}"`);
      } else {
        console.log(`🔍 [createNewPractice] Using provided subdomain: "${subdomain}" (length: ${subdomain.length})`);
      }
      
      // Fix RTL phone number display issue - normalize the phone format
      if (adminPhone) {
        // Remove RTL marks and normalize
        adminPhone = adminPhone.replace(/[\u200E\u200F\u202A-\u202E]/g, '');
        // Ensure + is at the beginning if it got moved
        if (adminPhone.includes('+') && !adminPhone.startsWith('+')) {
          adminPhone = '+' + adminPhone.replace('+', '');
        }
      }
      
      // Country must be provided explicitly from Google Places API or user input
      if (!country) {
        console.log('⚠️ No country provided - this should come from Google Places lookup or explicit user input');
        // Don't proceed without country - it's required
        return {
          success: false,
          message: language === 'he'
            ? 'מדינה לא צוינה. אנא ספק את המדינה של המרפאה.'
            : 'Country not specified. Please provide the practice\'s country.'
        };
      }
      
      console.log(`🌍 Using country: ${country} (provided by user or Google Places)`);
      
      // Normalize country names
      if (country === 'US' || country === 'USA' || country === 'United States' || country === 'United States of America') {
        country = 'USA';
      } else if (country === 'IL' || country === 'Israel') {
        country = 'Israel';
      }
      
      const emailService = require('./emailService');
      const databaseFactory = require('../utils/databaseFactory');
      const SecureDataAccess = require('./secureDataAccess');
      
      // Initialize database
      await databaseFactory.initialize();
      
      // Create context for secure data access
      const context = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'createNewPractice',
        practiceId: 'global'
      };
      
      // Check if subdomain exists
      const existingSubdomains = await SecureDataAccess.query('practices', { subdomain: subdomain.toLowerCase() }, { limit: 1 }, {
    ...context,
    apiKey: this.serviceToken?.apiKey || this.serviceToken
  });
      const existingSubdomain = existingSubdomains && existingSubdomains.length > 0 ? existingSubdomains[0] : null;
      if (existingSubdomain) {
        console.log(`⚠️ Practice with subdomain '${subdomain}' already exists`);
        return {
          success: false,
          practiceExists: true,
          existingPractice: {
            name: existingSubdomain.name,
            subdomain: existingSubdomain.subdomain
          },
          message: language === 'he'
            ? `המרפאה '${existingSubdomain.name}' כבר קיימת עם הכתובת ${subdomain}.intellicare.health\n\nאפשרויות:\n1. התחבר למרפאה קיימת - אמור "התחבר"\n2. צור מרפאה חדשה עם שם אחר`
            : `The practice '${existingSubdomain.name}' already exists at ${subdomain}.intellicare.health\n\nOptions:\n1. Login to existing practice - say "login"\n2. Create a new practice with a different name`
        };
      }
      
      // Also check if practice name already exists (warn but allow)
      const existingNames = await SecureDataAccess.query('practices', { name: practiceName }, { limit: 1 }, {
    ...context,
    apiKey: this.serviceToken?.apiKey || this.serviceToken
  });
      const existingName = existingNames && existingNames.length > 0 ? existingNames[0] : null;
      if (existingName) {
        console.log(`⚠️ Warning: Practice name '${practiceName}' already exists with subdomain '${existingName.subdomain}'`);
      }
      
      // Create practice data object
      const newPracticeData = {
        name: practiceName,
        subdomain: subdomain.toLowerCase(),
        status: 'active',
        subscription: {
          plan: 'professional',
          maxUsers: 50,
          maxPatients: 1000,
          features: ['ai_analysis', 'document_upload', 'multi_user', 'api_access'],
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        settings: {
          language: country === 'Israel' ? 'he' : 'en',
          timezone: country === 'Israel' ? 'Asia/Jerusalem' : 'America/New_York',
          dateFormat: country === 'Israel' ? 'DD/MM/YYYY' : 'MM/DD/YYYY',
          currency: country === 'Israel' ? 'ILS' : 'USD',
          patientIdFormat: country === 'Israel' ? 'il_id' : 'us_ssn',
          // Store opening hours from Google Places if available
          workingHours: openingHours ? {
            googlePlacesHours: openingHours,
            days: openingHours.weekdayDescriptions || []
          } : {
            // Default working hours
            start: '08:00',
            end: '18:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          }
        },
        contact: {
          phone: adminPhone || '+972-50-000-0000',
          email: adminEmail,
          website: website || `https://${subdomain}.intellicare.health`,
          address: {
            street: streetAddress || '',
            city: city || '',
            state: state || '',
            postalCode: zipCode || '',
            country: country // No default - must come from user input or Google Places
          }
        }
      };
      
      // Insert the new practice into the database
      const insertedPractice = await SecureDataAccess.insert('practices', newPracticeData, context);

      // Grant MongoDB permissions for the new practice database
      await this.setupPracticeDatabasePermissions(subdomain);

      // Create admin user data with provider info for scheduling
      const providerId = `PROV-${adminFirstName.toLowerCase()}-${adminLastName.toLowerCase()}`.replace(/\s+/g, '-');
      const adminUserData = {
        email: adminEmail.toLowerCase(),
        profile: {
          firstName: adminFirstName,
          lastName: adminLastName
        },
        roles: ['admin', 'doctor'],
        // Add providerInfo so admin can schedule appointments immediately
        providerInfo: {
          providerId: providerId,
          licenseNumber: '',  // Can be added later
          specialties: ['General Practice'],  // Default specialty
          departments: ['Primary Care'],  // Default department
          appointmentSettings: {
            defaultDuration: 30,
            bufferTime: 5,
            maxAdvanceBooking: 90,
            allowOnlineBooking: true,
            workingHours: {
              sunday: { start: '08:00', end: '17:00', isWorking: true },
              monday: { start: '08:00', end: '17:00', isWorking: true },
              tuesday: { start: '08:00', end: '17:00', isWorking: true },
              wednesday: { start: '08:00', end: '17:00', isWorking: true },
              thursday: { start: '08:00', end: '17:00', isWorking: true },
              friday: { start: '08:00', end: '14:00', isWorking: true },
              saturday: { isWorking: false }
            }
          }
        },
        permissions: [
          'read_patients', 'write_patients', 'delete_patients', 'export_patients',
          'read_documents', 'write_documents', 'delete_documents', 'export_documents',
          'manage_users', 'assign_roles', 'view_reports', 'system_admin',
          'manage_practice_settings', 'manage_billing', 'view_audit_logs'
        ],
        emailVerified: false,
        status: 'pending',
        isPasswordless: true,
        practiceSubdomain: subdomain.toLowerCase()
      };
      
      // Create context for practice-specific operations
      const practiceContext = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'createAdminUser',
        practiceId: subdomain.toLowerCase()
      };
      
      // Insert the admin user
      const adminUser = await SecureDataAccess.insert('users', adminUserData, practiceContext);
      
      // Get the inserted user ID (SecureDataAccess returns the document with _id)
      const adminUserId = adminUser._id;
      console.log('✅ [Auth AI] Admin user created with ID:', adminUserId);
      
      // Ensure we have a valid user ID
      if (!adminUserId) {
        console.error('❌ [Auth AI] No user ID returned from insert operation:', adminUser);
        throw new Error('Failed to get user ID after insertion');
      }
      
      // Generate verification token
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Store verification token in GLOBAL database
      // Use global context so the token can be found during email verification
      // Generate a 6-digit OTP code for email verification BEFORE storing
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('🔐 [Auth AI] Generated OTP code:', otpCode);
      
      const globalContext = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'storeVerificationToken',
        practiceId: 'global'
      };
      
      const verificationData = {
        userId: adminUserId.toString(),  // Convert ObjectId to string
        email: adminEmail.toLowerCase(),
        token: verificationToken,
        isUsed: false,
        used: false,  // Add both fields for compatibility
        practiceSubdomain: subdomain.toLowerCase(), // Store subdomain for reference
        otpCode: otpCode,  // Store OTP code directly
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // OTP expires in 10 minutes
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
      
      try {
        console.log('📝 [Auth AI] About to store verification data:', {
          ...verificationData,
          token: verificationData.token.substring(0, 10) + '...' // Truncate token for security
        });
        
        const insertResult = await SecureDataAccess.insert('emailverifications', verificationData, globalContext);
        console.log('✅ [Auth AI] Verification token stored:', {
          tokenPrefix: verificationToken.substring(0, 10) + '...',
          userId: adminUserId.toString(),
          subdomain: subdomain.toLowerCase(),
          insertedId: insertResult ? insertResult.insertedId : 'NO_RESULT',
          otpCode: otpCode // Confirm OTP was in the insert
        });
      } catch (insertError) {
        console.error('❌ [Auth AI] Failed to store verification token:', insertError);
        throw insertError;
      }
      
      // Initialize email service before sending
      await emailService.initialize();
      
      // Send OTP code email (OTP was already generated and stored above)
      await emailService.sendOTPCode(
        adminEmail,
        otpCode,
        practiceName
      );
      
      return {
        success: true,
        message: language === 'he'
          ? `✅ המרפאה '${practiceName}' נוצרה בהצלחה!\n\n📧 קוד אימות בן 6 ספרות נשלח ל-${adminEmail}\n\n🔢 **אנא הכניסו את הקוד כאן בצ'אט כדי להשלים את ההרשמה.**\n\nהקוד תקף ל-10 דקות.`
          : `✅ Practice '${practiceName}' created successfully!\n\n📧 A 6-digit verification code has been sent to ${adminEmail}\n\n🔢 **Please enter the code here in the chat to complete registration.**\n\nThe code expires in 10 minutes.`,
        conversationComplete: false,  // Keep conversation open for OTP entry
        waitingForOTP: true,
        email: adminEmail,  // Include email for frontend to use
        practiceSubdomain: subdomain
      };
      
    } catch (error) {
      console.error('❌ Create practice error:', error);
      return {
        success: false,
        message: `Failed to create practice: ${error.message}`
      };
    }
  }

  async loginUser({ email, practiceSubdomain }, language = 'en', currentSubdomain = null) {
    try {
      // Guard against placeholder values
      if (!email || email.toLowerCase().includes('needed') || email.toLowerCase().includes('placeholder')) {
        return {
          success: false,
          message: language === 'he' 
            ? 'מה כתובת האימייל שלך?' 
            : "What's your email address?"
        };
      }
      
      const emailService = require('./emailService');
      const databaseFactory = require('../utils/databaseFactory');
      const SecureDataAccess = require('./secureDataAccess');
      
      // Create context for secure data access
      const context = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'loginUser',
        practiceId: 'global'
      };
      
      await databaseFactory.initialize();
      const globalDb = await databaseFactory.getGlobalDatabase();
      
      // Use current subdomain if available and no practice subdomain was explicitly provided
      if (!practiceSubdomain && currentSubdomain) {
        console.log(`✅ [Auth AI] Auto-using current subdomain: ${currentSubdomain}`);
        practiceSubdomain = currentSubdomain;
      }
      
      // If no practice subdomain provided (and not on a subdomain), find all practices for this email
      let practice;
      let userPractices = [];
      
      if (!practiceSubdomain) {
        // Search all practice databases for this email
        const allPractices = await SecureDataAccess.query('practices', {
          $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }, {}, context);

        // Check each practice for this user
        for (const c of allPractices) {
          try {
            // Use SecureDataAccess - no direct database access needed
            const practiceContext = {
              serviceId: 'auth-ai-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              operation: 'findUser',
              practiceId: c.subdomain
            };
            
            const users = await SecureDataAccess.query('users', {
              email: email.toLowerCase(),
              emailVerified: true,
              status: 'active'
            }, { limit: 1 }, practiceContext);
            
            if (users && users.length > 0) {
              userPractices.push(c);
            }
          } catch (err) {
            // Skip practices we can't access
            console.log(`Skipping practice ${c.subdomain}: ${err.message}`);
          }
        }
        
        // Handle results based on number of practices found
        if (userPractices.length === 0) {
          return {
            success: false,
            message: language === 'he'
              ? `לא נמצא חשבון עבור ${email} באף מרפאה במערכת.`
              : `No account found for ${email} in any practice.`
          };
        } else if (userPractices.length === 1) {
          // Auto-select the single practice
          practice = userPractices[0];
          practiceSubdomain = practice.subdomain;
          console.log(`✅ Auto-selected practice ${practiceSubdomain} for ${email}`);
        } else {
          // Multiple practices - need user to choose
          const practiceList = userPractices.map(c => `• ${c.name} (${c.subdomain})`).join('\n');
          return {
            success: false,
            needsPracticeSelection: true,
            practices: userPractices.map(c => ({ name: c.name, subdomain: c.subdomain })),
            message: language === 'he'
              ? `נמצאו מספר מרפאות עבור ${email}. באיזו מרפאה תרצה להתחבר?\n\n${practiceList}`
              : `You have access to multiple practices. Which one would you like to login to?\n\n${practiceList}`
          };
        }
      } else {
        // Practice subdomain was provided - verify it exists
        const practices = await SecureDataAccess.query('practices', { 
          subdomain: practiceSubdomain, 
          $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
        }, { limit: 1 }, context);
        practice = practices[0];
        
        if (!practice) {
          const message = language === 'he'
            ? `המרפאה '${practiceSubdomain}' לא קיימת במערכת.`
            : `Practice '${practiceSubdomain}' does not exist.`;
          return {
            success: false,
            message
          };
        }
      }
      
      // Practice database is handled through SecureDataAccess - no direct connection needed

      // Find user - update context to use practice database
      const practiceContext = {
        ...context,
        practiceId: practiceSubdomain
      };
      const users = await SecureDataAccess.query('users', { 
        email: email.toLowerCase(),
        emailVerified: true,
        status: 'active'
      }, { limit: 1 }, practiceContext);
      const user = users[0];
      
      if (!user) {
        return {
          success: false,
          message: language === 'he'
            ? `לא נמצא חשבון פעיל עבור ${email} במרפאה ${practiceSubdomain}.`
            : `No active account found for ${email} at practice ${practiceSubdomain}.`
        };
      }

      // DEV MODE: Direct login without OTP
      const secureConfigService = require('./secureConfigService');
      if (secureConfigService.get('NODE_ENV') === 'development') {
        console.log('🔓 [DEV] Bypassing OTP - creating session directly');

        const SecureSessionManager = require('./secureSessionManager');
        const ObjectId = require('mongoose').Types.ObjectId;

        // Convert user ID to ObjectId if needed
        let userId;
        if (user._id instanceof ObjectId) {
          userId = user._id;
        } else if (typeof user._id === 'string') {
          userId = new ObjectId(user._id);
        } else {
          userId = new ObjectId(user._id.toString());
        }

        // Get user's full name from profile
        const userFullName = user.profile
          ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim()
          : user.email;

        // Create session using SecureSessionManager (same as production)
        const session = await SecureSessionManager.createSession(
          userId.toString(),
          user.practiceId,
          user.role || 'user',
          {
            practiceSubdomain: practiceSubdomain,
            email: user.email,
            name: userFullName,
            verificationMethod: 'dev-mode',
            emailVerified: true
          }
        );

        console.log(`✅ [DEV] Session created with token: ${session.sessionToken.substring(0, 10)}...`);
        console.log(`🔐 [DEV] CSRF token: ${session.csrfToken ? session.csrfToken.substring(0, 10) + '...' : 'none'}`);
        console.log(`👤 [DEV] Logged in as: ${userFullName} (${user.email})`);

        const message = language === 'he'
          ? `✅ מצב פיתוח: התחברת ישירות כ-${userFullName}`
          : `✅ DEV MODE: Logged in directly as ${userFullName}`;

        return {
          success: true,
          message,
          devMode: true,
          sessionToken: session.sessionToken,
          csrfToken: session.csrfToken,
          redirectToChat: true,  // Signal frontend to redirect
          user: {
            id: user._id.toString(),
            name: userFullName,
            email: user.email,
            role: user.role,
            practiceId: user.practiceId,
            practiceSubdomain: practiceSubdomain
          }
        };
      }

      // PRODUCTION MODE: Use OTP
      const otpService = require('./otpService');

      // Initialize OTP service
      await otpService.initialize();

      // Generate and send OTP code
      const otpResult = await otpService.createOTP(email, practiceSubdomain);

      // Get practice name for email (we already have 'practice' from above)
      const practiceName = practice.name;

      // Initialize email service before sending
      await emailService.initialize();

      // Send OTP code email
      await emailService.sendOTPCode(
        email,
        otpResult.code,
        practiceName
      );

      const message = language === 'he'
        ? `✅ קוד אימות נשלח ל-${email}\n\n📧 הזן את הקוד בן 6 הספרות שקיבלת באימייל.\nהקוד יפוג בעוד 10 דקות.`
        : `✅ Verification code sent to ${email}\n\n📧 Enter the 6-digit code from your email.\nThe code expires in 10 minutes.`;

      return {
        success: true,
        message,
        requiresOTP: true,  // Signal frontend to show OTP input
        email: email,       // Pass email for OTP verification
        practiceSubdomain: practiceSubdomain
      };
      
    } catch (error) {
      // Check if this is a rate limit error
      const isRateLimitError = error.message?.includes('Please wait') || error.message?.includes('seconds');

      if (isRateLimitError) {
        // Clean log for rate limit (not an actual error, just a security measure)
        console.log('⏱️ [Auth AI] Rate limit active:', error.message);
      } else {
        // Full error log for actual errors
        console.error('❌ Login error:', error);
      }

      const message = language === 'he'
        ? `ההתחברות נכשלה: ${error.message}`
        : `Login failed: ${error.message}`;
      return {
        success: false,
        message
      };
    }
  }

  async verifyOTPCode({ code, email }, language = 'en', currentSubdomain = null) {
    try {
      console.log(`🔑 [Auth AI] Verifying OTP code for ${email}`);
      
      // Initialize OTP service
      const otpService = require('./otpService');
      await otpService.initialize();
      
      // Verify the OTP code
      const verificationResult = await otpService.verifyOTP(email, code);
      
      if (!verificationResult.success) {
        const message = language === 'he'
          ? `❌ ${verificationResult.error}`
          : `❌ ${verificationResult.error}`;
        
        return {
          success: false,
          message,
          remainingAttempts: verificationResult.remainingAttempts
        };
      }
      
      // Get practice subdomain from verification result or current context
      const practiceSubdomain = verificationResult.practiceSubdomain || currentSubdomain;
      
      // Create security context
      const context = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceSubdomain || 'global'
      };
      
      // Find user in the database
      const users = await SecureDataAccess.query('users', {
        email: email.toLowerCase(),
        emailVerified: true,
        status: 'active'
      }, { limit: 1 }, context);
      
      if (!users || users.length === 0) {
        const message = language === 'he'
          ? '❌ משתמש לא נמצא. אנא הרשם תחילה.'
          : '❌ User not found. Please register first.';
        
        return {
          success: false,
          message
        };
      }
      
      const user = users[0];
      
      // Update last login
      await SecureDataAccess.update(
        'users', { _id: user._id }, { $set: { lastLogin: new Date() } }, {
    ...context,
    apiKey: this.serviceToken?.apiKey || this.serviceToken
  });
      
      // Get practice information
      let practice = null;
      if (practiceSubdomain) {
        const practices = await SecureDataAccess.query('practices', {
          subdomain: practiceSubdomain
        }, { limit: 1 }, {
          serviceId: 'auth-ai-service',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          practiceId: 'global'
        });
        
        if (practices && practices.length > 0) {
          practice = practices[0];
        }
      }
      
      // Create session for the user (just like verifyEmailOTP does)
      let sessionData = null;
      if (user && practice) {
        try {
          console.log('🔒 [Auth AI] Creating session for verified login user...');
          
          const SecureSessionManager = require('./secureSessionManager');
          
          // Get user role (default to 'user' if not set)
          const userRole = user.roles?.[0] || user.role || 'user';
          console.log('🎯 [Auth AI] Using role for session:', userRole);
          
          const session = await SecureSessionManager.createSession(
            user._id.toString(),
            practice._id.toString(),
            userRole,
            {
              practiceSubdomain: practiceSubdomain,
              email: user.email,
              name: `${user.profile?.firstName || user.firstName || ''} ${user.profile?.lastName || user.lastName || ''}`.trim(),
              verificationMethod: 'otp_login',
              emailVerified: true
            }
          );
          
          sessionData = {
            sessionToken: session.sessionToken,
            csrfToken: session.csrfToken
          };
          
          console.log('✅ [Auth AI] Session created for OTP login');
        } catch (sessionError) {
          console.error('❌ [Auth AI] Failed to create session:', sessionError);
          // Continue without session - don't fail the whole login
        }
      }
      
      // Prepare success message
      const successMessage = language === 'he'
        ? `✅ אומת בהצלחה! ברוך הבא, ${user.firstName || user.email}!\n\n🏥 אתה מחובר כעת למרפאה שלך.`
        : `✅ Verified successfully! Welcome, ${user.firstName || user.email}!\n\n🏥 You are now logged in to your practice.`;
      
      // Check if redirect is needed
      const currentHost = currentSubdomain || '';
      const needsRedirect = practiceSubdomain && practiceSubdomain !== currentHost;
      
      const redirectUrl = needsRedirect 
        ? `http://${practiceSubdomain}.intellicare.health:3000/dashboard`
        : null;
      
      return {
        success: true,
        message: successMessage,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        practice: practice ? {
          id: practice._id,
          name: practice.name,
          subdomain: practice.subdomain
        } : null,
        needsRedirect,
        redirectUrl,
        sessionCreated: true,
        ...sessionData  // Include sessionToken and csrfToken if created
      };
      
    } catch (error) {
      console.error('❌ OTP verification error:', error);
      const message = language === 'he'
        ? `❌ אימות נכשל: ${error.message}`
        : `❌ Verification failed: ${error.message}`;
      
      return {
        success: false,
        message
      };
    }
  }

  async signupUser({ practiceSubdomain, firstName, lastName, email }, language = 'en') {
    // Detect Hebrew up-front so it's available in BOTH the try and catch scopes.
    // (Previously declared inside try → ReferenceError in catch on any failure.)
    const isHebrew = language === 'he' || /[֐-׿]/.test(`${firstName || ''}${lastName || ''}`);
    try {
      // Accept both "yale" and "yale.intellicare.health" (and full URLs) —
      // normalize to the bare subdomain label before any lookup.
      practiceSubdomain = this.normalizeSubdomain(practiceSubdomain);

      const databaseFactory = require('../utils/databaseFactory');
      
      // Create context for secure data access
      const context = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'signupUser',
        practiceId: practiceSubdomain
      };

      // FIRST: Check if practice exists in global registry - using SecureDataAccess.
      // 'practices' lives in the GLOBAL database and has no practiceId field, so this
      // lookup MUST use a 'global' context. With a practice-scoped context, row-level
      // security injects { practiceId: <subdomain> } into the filter and the lookup
      // never matches — this is why joining an existing practice reported
      // "Practice does not exist". (checkPracticeExists/createNewPractice already
      // use 'global' here.)
      const globalContext = { ...context, practiceId: 'global' };
      const practices = await SecureDataAccess.query('practices', {
        subdomain: practiceSubdomain,
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }]
      }, { limit: 1 }, globalContext);
      const practice = practices[0];
      
      if (!practice) {
        const message = isHebrew 
          ? `המרפאה '${practiceSubdomain}' לא קיימת במערכת. וודא שהמרפאה קיימת תחילה.`
          : `Practice '${practiceSubdomain}' does not exist. Make sure the practice exists first.`;
        return {
          success: false,
          message
        };
      }
      
      // Only NOW get the practice database (after verifying practice exists)
      // Using internal flag since we need it for model creation only
      const practiceDb = await databaseFactory.getPracticeDatabase(practiceSubdomain, true);
      
      // Models are handled through SecureDataAccess - no direct model imports needed
      
      // Check if user exists
      const existingUsers = await SecureDataAccess.query('users', { email: email.toLowerCase() }, { limit: 1 }, {
    ...context,
    apiKey: this.serviceToken?.apiKey || this.serviceToken
  });
      const existing = existingUsers[0];
      if (existing) {
        const message = isHebrew
          ? `משתמש עם כתובת המייל ${email} כבר קיים במרפאה זו.`
          : `User with email ${email} already exists at this practice.`;
        return {
          success: false,
          message
        };
      }
      
      // Create the user as an immediately-active, passwordless account.
      // NOTE: email verification is intentionally SKIPPED — we do not use
      // SendGrid. New users can log in right away via the passwordless
      // dev-login flow (no verification code), exactly like existing users.
      const userData = {
        email: email.toLowerCase(),
        profile: {
          firstName,
          lastName
        },
        practiceSubdomain,                       // explicit practice association
        roles: roleModel.normalizeRoles(['user']), // basic 'user' role (view-only) — admin can upgrade later
        permissions: ['read_patients', 'read_documents'],
        emailVerified: true,                     // auto-verified (no email step)
        status: 'active',                        // active immediately
        isPasswordless: true,
        preferredLanguage: language === 'he' ? 'he' : 'en'
      };

      await SecureDataAccess.insert('users', userData, context);

      // Success — account is ready immediately, no verification code needed.
      const loginUrl = `${practiceSubdomain}.intellicare.health`;
      const message = isHebrew
        ? `✅ החשבון נוצר עבור ${firstName} ${lastName}!\n\nהצטרפת כמשתמש בסיסי עם הרשאות צפייה בלבד. אם תזדקק להרשאות נוספות, בקש ממנהל המרפאה לשדרג את התפקיד שלך (רופא/אחות/מנהל).\n\nניתן להתחבר עכשיו עם כתובת המייל ${email} — לא נדרש קוד אימות.\n\nכתובת המרפאה: ${loginUrl}`
        : `✅ Account created for ${firstName} ${lastName}!\n\nYou've joined as a basic User with view-only access. If you need more, ask your practice admin to upgrade your role (Doctor/Nurse/Admin).\n\nYou can log in right now with ${email} — no verification code needed.\n\nPractice: ${loginUrl}`;

      return {
        success: true,
        message,
        conversationComplete: true,
        // Returned so the frontend can auto-login the new user and redirect them to
        // the practice subdomain (registration happens on the root domain, but login
        // lives at <subdomain>.intellicare.health).
        email: email.toLowerCase(),
        practiceSubdomain,
        autoLogin: true
      };

    } catch (error) {
      console.error('❌ Signup error:', error);
      const message = isHebrew
        ? `ההרשמה נכשלה: ${error.message}`
        : `Signup failed: ${error.message}`;
      return {
        success: false,
        message
      };
    }
  }

  async verifyEmailOTP({ code, email, subdomain }, language = 'en', currentSubdomain = null) {
    try {
      console.log(`🔑 [Auth AI] Verifying email OTP for ${email} (practice: ${subdomain})`);
      
      const SecureDataAccess = require('./secureDataAccess');
      const databaseFactory = require('../utils/databaseFactory');
      
      // Initialize database
      await databaseFactory.initialize();
      
      // Find the email verification record with the OTP code
      const context = {
        serviceId: 'auth-ai-service',
        operation: 'verify-email-otp',
        practiceId: 'global'
      };
      
      // Query for the verification record
      console.log('🔍 [Auth AI] Searching for OTP with query:', {
        email: email.toLowerCase(),
        otpCode: code,
        used: false,
        otpExpiry: { $gt: new Date() }
      });
      
      const verificationRecords = await SecureDataAccess.query(
        'emailverifications',
        {
          email: email.toLowerCase(),
          otpCode: code,
          used: false,
          otpExpiry: { $gt: new Date() }  // Check OTP expiry (10 minutes) not email token expiry (24 hours)
        },
        { limit: 1 },
        context
      );
      
      console.log('📊 [Auth AI] Verification records found:', verificationRecords ? verificationRecords.length : 0);
      
      if (!verificationRecords || verificationRecords.length === 0) {
        // Let's see what records exist for this email
        console.log('🔍 [Auth AI] No valid OTP found. Checking all records for email...');
        const allRecords = await SecureDataAccess.query(
          'emailverifications',
          {
            email: email.toLowerCase()
          },
          { limit: 5 },
          context
        );
        
        console.log('📊 [Auth AI] All verification records for email:', allRecords ? allRecords.map(r => ({
          otpCode: r.otpCode,
          used: r.used,
          isUsed: r.isUsed,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
          hasSecurityMetadata: !!r._securityMetadata,
          allFields: Object.keys(r).join(', ')
        })) : 'none');
        
        // Check if OTP expired
        const expiredRecords = await SecureDataAccess.query(
          'emailverifications',
          {
            email: email.toLowerCase(),
            otpCode: code,
            used: false
          },
          { limit: 1 },
          context
        );
        
        if (expiredRecords && expiredRecords.length > 0) {
          return {
            success: false,
            message: language === 'he'
              ? '❌ הקוד פג תוקף. אנא בקשו קוד חדש.'
              : '❌ The code has expired. Please request a new code.'
          };
        }
        
        return {
          success: false,
          message: language === 'he'
            ? '❌ קוד שגוי. אנא בדקו את הקוד ונסו שוב.'
            : '❌ Invalid code. Please check the code and try again.'
        };
      }
      
      const verificationRecord = verificationRecords[0];
      
      // Mark the verification as used
      await SecureDataAccess.update(
        'emailverifications',
        { _id: verificationRecord._id },
        { $set: { used: true, verifiedAt: new Date() } },
        context
      );
      
      // Update user as email verified
      const practiceContext = {
        serviceId: 'auth-ai-service',
        operation: 'mark-email-verified',
        practiceId: subdomain
      };
      
      await SecureDataAccess.update(
        'users',
        { email: email.toLowerCase() },
        { $set: { emailVerified: true, status: 'active' } },
        practiceContext
      );
      
      // Get the user and practice details for session creation
      const users = await SecureDataAccess.query(
        'users',
        { email: email.toLowerCase() },
        { limit: 1 },
        practiceContext
      );
      const user = users[0];
      
      const practices = await SecureDataAccess.query(
        'practices',
        { subdomain: subdomain },
        { limit: 1 },
        context // Use global context for practices
      );
      const practiceDoc = practices[0];
      
      // Create session for immediate login
      let sessionData = null;
      if (user && practiceDoc) {
        try {
          console.log('🔒 [Auth AI] Creating session for verified user...');
          console.log('🔍 [Auth AI] User object:', {
            id: user._id,
            email: user.email,
            roles: user.roles,
            rolesType: typeof user.roles,
            rolesLength: user.roles?.length,
            firstRole: user.roles?.[0],
            status: user.status,
            emailVerified: user.emailVerified
          });
          
          const SecureSessionManager = require('./secureSessionManager');
          
          const userRole = user.roles?.[0] || 'user';
          console.log('🎯 [Auth AI] Using role for session:', userRole);
          
          const session = await SecureSessionManager.createSession(
            user._id.toString(),
            practiceDoc._id.toString(),
            userRole,
            {
              practiceSubdomain: subdomain,
              email: user.email,
              name: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
              verificationMethod: 'email_verification',
              emailVerified: true
            }
          );
          
          sessionData = {
            sessionToken: session.sessionToken,
            csrfToken: session.csrfToken
          };
          
          console.log('✅ [Auth AI] Session created for immediate login');
        } catch (sessionError) {
          console.error('⚠️ [Auth AI] Failed to create session:', sessionError.message);
          // Continue without session - user can login manually
        }
      }
      
      // Success message with practice URL
      const practiceUrl = process.env.NODE_ENV === 'production'
        ? `https://${subdomain}.intellicare.health`
        : `http://${subdomain}.intellicare.health:3000`;
      
      return {
        success: true,
        message: language === 'he'
          ? `✅ האימייל אומת בהצלחה!\n\n🎉 ברוכים הבאים ל-IntelliCare!\n\n🔗 מעביר אותך למרפאה שלך...`
          : `✅ Email verified successfully!\n\n🎉 Welcome to IntelliCare!\n\n🔗 Redirecting to your practice...`,
        emailVerified: true,
        practiceUrl: practiceUrl,
        subdomain: subdomain,
        autoLogin: true,
        ...sessionData // Include session data if created
      };
      
    } catch (error) {
      console.error('❌ [Auth AI] Email OTP verification error:', error);
      return {
        success: false,
        message: language === 'he'
          ? '❌ שגיאה באימות הקוד. אנא נסו שוב.'
          : '❌ Error verifying the code. Please try again.'
      };
    }
  }

  async listAvailablePractices() {
    // SECURITY: Don't expose real practice information
    return {
      success: false,
      message: 'For privacy and security reasons, I cannot list existing practices. Each practice is private and confidential. If you need to join a specific practice, please ask your practice administrator for the exact subdomain.'
    };
    
    // OLD CODE - DISABLED FOR SECURITY
    // This would expose private practice information
    // 
    // try {
    //   const databaseFactory = require('../utils/databaseFactory');
    //   await databaseFactory.initialize();
    //   
    //   const globalDb = await null; // SECURITY: Direct database access removed - use SecureDataAccess
    //   Models are handled through SecureDataAccess - no direct model imports needed
    //   
    //   const practices = await SecureDataAccess.query('practices', { status: 'active' }, {}, {
    //     ...context,
    //     apiKey: this.serviceToken?.apiKey || this.serviceToken
    //   })
    //     .select('name subdomain')
    //     .limit(10);
    //   
    //   if (practices.length === 0) {
    //     return {
    //       success: true,
    //       message: 'No practices available yet. You can create the first one!'
    //     };
    //   }
    //
    //   const practiceList = practices.map(c => `• ${c.name} (${c.subdomain}.intellicare.health)`).join('\n');
    //
    //   return {
    //     success: true,
    //     message: `Available practices:\n${practiceList}`
    //   };
    //
    // } catch (error) {
    //   console.error('❌ List practices error:', error);
    //   return {
    //     success: false,
    //     message: `Failed to list practices: ${error.message}`
    //   };
    // }
  }

  getUsageStats() {
    const cacheHitRate = this.stats.totalRequests > 0 
      ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2) 
      : 0;
    
    // Estimate cost savings from prompt caching (90% reduction on cached tokens)
    const estimatedSavingsPercent = this.stats.promptCacheTokensSaved > 0 ? 90 : 0;
    
    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      estimatedSavingsPercent: `${estimatedSavingsPercent}%`,
      promptCaching: {
        enabled: true,
        model: 'claude-sonnet-5',
        systemPromptCached: true,
        toolsCached: true,
        conversationCaching: 'older messages cached after 4 turns'
      }
    };
  }

  /**
   * Normalize a practice subdomain so users can enter either the bare label
   * ("yale") or the full host ("yale.intellicare.health", or even a pasted
   * "https://yale.intellicare.health/"). Returns the lowercased subdomain
   * label — the part before the first dot.
   */
  normalizeSubdomain(input) {
    if (!input || typeof input !== 'string') return '';
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')  // strip protocol if a full URL was pasted
      .replace(/\/.*$/, '')          // strip any path/query
      .split('.')[0]                 // "yale.intellicare.health" -> "yale"
      .trim();
  }

  async checkPracticeExists({ subdomain }, language = 'en') {
    try {
      // Accept both "yale" and "yale.intellicare.health" (and full URLs).
      subdomain = this.normalizeSubdomain(subdomain);
      console.log(`🔍 [checkPracticeExists] Checking subdomain: "${subdomain}" (length: ${subdomain ? subdomain.length : 0})`);
      const SecureDataAccess = require('./secureDataAccess');
      
      // Create a minimal context for the secure data access
      const context = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'checkPracticeExists',
        practiceId: 'global' // Checking global practice registry
      };
      
      const practices = await SecureDataAccess.query('practices', { subdomain: subdomain.toLowerCase() }, { limit: 1 }, {
    ...context,
    apiKey: this.serviceToken?.apiKey || this.serviceToken
  });
      const practice = practices && practices.length > 0 ? practices[0] : null;
      
      if (practice) {
        return {
          success: true,
          exists: true,
          message: language === 'he' 
            ? `הכתובת '${subdomain}' כבר תפוסה על ידי '${practice.name}'.`
            : `Practice '${subdomain}' exists as '${practice.name}'.`
        };
      } else {
        return {
          success: true,
          exists: false,
          message: language === 'he'
            ? `הכתובת '${subdomain}' זמינה! ✅`
            : `Practice '${subdomain}' is available.`
        };
      }
      
    } catch (error) {
      console.error('❌ Check practice error:', error);
      return {
        success: false,
        message: `Failed to check practice: ${error.message}`
      };
    }
  }

  /**
   * Auto-generate a smart subdomain from practice name and location
   * @param {string} practiceName - The practice name
   * @param {string} city - The city name (optional)
   * @param {string} language - User's language preference
   * @returns {Promise<{success: boolean, subdomain: string, message: string}>}
   */
  async generateSmartSubdomain(practiceName, city = null, language = 'en') {
    try {
      console.log(`🤖 [generateSmartSubdomain] Generating subdomain for: "${practiceName}" in "${city || 'unknown'}"`);

      // Clean and normalize the practice name
      let base = practiceName.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      // Common words to remove for brevity
      const removeWords = ['medical', 'center', 'centre', 'hospital', 'health', 'healthcare', 'care', 'institute', 'group', 'associates', 'practice', 'clinic', 'clinics', 'the', 'and', 'of', 'for', 'services'];
      const words = base.split('-');
      base = words.filter(word => !removeWords.includes(word)).join('-');
      
      // If base is too short or empty, use original cleaned name
      if (!base || base.length < 3) {
        base = practiceName.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
      }
      
      // Ensure max 30 characters
      if (base.length > 30) {
        // Try to cut at word boundary
        base = base.substring(0, 30);
        const lastDash = base.lastIndexOf('-');
        if (lastDash > 15) { // Keep at least 15 chars
          base = base.substring(0, lastDash);
        }
      }
      
      // Check if base subdomain is available
      let subdomain = base;
      let attempt = 0;
      let available = false;
      
      const SecureDataAccess = require('./secureDataAccess');
      const context = {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'generateSmartSubdomain',
        practiceId: 'global'
      };
      
      while (!available && attempt < 10) {
        const checkSubdomain = attempt === 0 ? subdomain : `${subdomain}-${attempt}`;
        console.log(`  Checking availability: ${checkSubdomain}`);

        const practices = await SecureDataAccess.query('practices', { subdomain: checkSubdomain }, { limit: 1 }, {
    ...context,
    apiKey: this.serviceToken?.apiKey || this.serviceToken
  });

        if (!practices || practices.length === 0) {
          subdomain = checkSubdomain;
          available = true;
        } else {
          attempt++;
          // Try adding city name if we haven't yet - but avoid duplication
          if (attempt === 1 && city) {
            const cityPart = city.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
            // Check if city is already in the base subdomain to avoid duplication
            if (!base.includes(cityPart)) {
              subdomain = `${base}-${cityPart}`.substring(0, 30);
              attempt--; // Don't count this as an attempt
            }
          }
        }
      }
      
      if (!available) {
        // Last resort: add timestamp
        const timestamp = Date.now().toString().slice(-6);
        subdomain = `${base.substring(0, 23)}-${timestamp}`;
      }
      
      console.log(`✅ [generateSmartSubdomain] Generated: "${subdomain}"`);
      
      return {
        success: true,
        subdomain: subdomain,
        message: language === 'he'
          ? `יצרתי עבורך כתובת אוטומטית: ${subdomain}.intellicare.health`
          : `I've automatically generated your practice URL: ${subdomain}.intellicare.health`
      };
      
    } catch (error) {
      console.error('❌ [generateSmartSubdomain] Error:', error);
      // Fallback to simple timestamp-based subdomain
      const fallback = `practice-${Date.now()}`;
      return {
        success: true,
        subdomain: fallback,
        message: language === 'he'
          ? `יצרתי כתובת זמנית: ${fallback}.intellicare.health`
          : `Generated temporary URL: ${fallback}.intellicare.health`
      };
    }
  }

  async lookupLocation({ query }, language = 'en') {
    try {
      // Use agentServiceV4's discoverPractice function
      const agentV4 = require('./agentServiceV4');
      await agentV4.initialize();

      console.log(`🔍 [Auth AI] Looking up location: "${query}"`);

      // Use discoverPractice but don't create a record yet
      const result = await agentV4.discoverPractice({
        practiceName: query,
        location: null,
        createRecord: false
      }, {
        language: language
      });

      if (!result.success || !result.data) {
        return {
          success: false,
          message: language === 'he'
            ? `לא הצלחתי למצוא את "${query}". אנא ספק את שם העיר או העסק בצורה ברורה יותר.`
            : `I couldn't find "${query}". Please provide a clearer city or business name.`
        };
      }

      // Extract practice data
      const practice = result.data;

      // Format as business type response
      let message;
      if (language === 'he') {
        message = `## אימות פרטי המרפאה\n\n`;
        message += `זיהינו את פרטי המרפאה הבאים:\n\n`;
        message += `### ${practice.name}\n\n`;
        message += `**כתובת**\n`;
        message += `${practice.contact.address.street}\n`;
        message += `${practice.contact.address.city}, ${practice.contact.address.state} ${practice.contact.address.postalCode || ''}\n\n`;
        if (practice.contact.phone) {
          message += `**טלפון**\n`;
          message += `${practice.contact.phone}\n\n`;
        }
        if (practice.contact.website) {
          message += `**אתר אינטרנט**\n`;
          message += `${practice.contact.website}\n\n`;
        }
        message += `---\n\n`;
        message += `אנא אשר שאלו פרטי המרפאה שלך. אם יש צורך בעדכון פרטים, ספר לי אילו שינויים נדרשים.`;
      } else {
        message = `## Practice Verification\n\n`;
        message += `We've identified the following practice information:\n\n`;
        message += `### ${practice.name}\n\n`;
        message += `**Address**\n`;
        message += `${practice.contact.address.street}\n`;
        message += `${practice.contact.address.city}, ${practice.contact.address.state} ${practice.contact.address.postalCode || ''}\n\n`;
        if (practice.contact.phone) {
          message += `**Phone**\n`;
          message += `${practice.contact.phone}\n\n`;
        }
        if (practice.contact.website) {
          message += `**Website**\n`;
          message += `${practice.contact.website}\n\n`;
        }
        if (practice.type) {
          message += `**Type**\n`;
          message += `${practice.type}\n\n`;
        }
        message += `---\n\n`;
        message += `Please confirm this is your practice. If any details need updating, let me know what changes are needed.`;
      }

      // Return in the format expected by authAI
      return {
        success: true,
        type: 'business',
        businessName: practice.name,
        name: practice.name,
        streetAddress: practice.contact.address.street,
        address: practice.contact.address.street,
        city: practice.contact.address.city,
        state: practice.contact.address.state,
        stateCode: practice.contact.address.state,
        zipCode: practice.contact.address.postalCode,
        country: practice.contact.address.country,
        countryCode: practice.contact.address.country === 'Israel' ? 'IL' : 'US',
        phone: practice.contact.phone,
        website: practice.contact.website,
        openingHours: practice.settings?.workingHours?.googlePlacesHours,
        fullAddress: `${practice.contact.address.street}, ${practice.contact.address.city}, ${practice.contact.address.state} ${practice.contact.address.postalCode}`,
        isUSA: practice.contact.address.country === 'USA' || practice.contact.address.country === 'United States',
        isIsrael: practice.contact.address.country === 'Israel',
        isMedical: true,
        message
      };

    } catch (error) {
      console.error('❌ Location lookup error:', error);
      return {
        success: false,
        message: language === 'he' 
          ? 'אירעה שגיאה בחיפוש המיקום. אנא נסה שוב.'
          : 'Error looking up location. Please try again.'
      };
    }
  }

  async resendEmailVerification({ email, reason }, language = 'en', currentSubdomain = null) {
    try {
      // Validate email
      if (!email) {
        return {
          success: false,
          message: language === 'he' 
            ? 'כתובת אימייל נדרשת'
            : 'Email address is required'
        };
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return {
          success: false,
          message: language === 'he' 
            ? 'פורמט אימייל לא תקין'
            : 'Invalid email format'
        };
      }
      
      console.log(`📧 [Auth AI] Resending email verification to: ${email}`);
      
      // Get email service
      const emailService = require('./emailService');
      
      // Initialize email service if needed
      if (!emailService.isInitialized()) {
        await emailService.initialize();
      }
      
      // Generate new verification token
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      
      // Find the user and their practice
      const SecureDataAccess = require('./secureDataAccess');
      
      let userFound = false;
      let userPractice = null;
      let userData = null;
      
      // If currentSubdomain is provided, check there first
      if (currentSubdomain) {
        console.log(`🔍 [Auth AI] Checking current subdomain first: ${currentSubdomain}`);
        
        const practiceContext = {
          serviceId: 'auth-ai-service',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          operation: 'resendEmailVerification',
          practiceId: currentSubdomain,
          practiceSubdomain: currentSubdomain
        };
        
        const users = await SecureDataAccess.query('users', 
          { email: email.toLowerCase() }, 
          { limit: 1 }, 
          practiceContext
        );
        
        if (users && users.length > 0) {
          userFound = true;
          userData = users[0];
          
          // Get practice info
          const practices = await SecureDataAccess.query('practices', 
            { subdomain: currentSubdomain }, 
            { limit: 1 }, 
            {
              serviceId: 'auth-ai-service',
              apiKey: this.serviceToken?.apiKey || this.serviceToken,
              operation: 'resendEmailVerification',
              practiceId: 'global'
            }
          );
          
          if (practices && practices.length > 0) {
            userPractice = practices[0];
          }
        }
      }
      
      // If not found in current subdomain, search all practices
      if (!userFound) {
        // Search across all practices for this email
        // Use global context to query practices from the global database
        const practices = await SecureDataAccess.query('practices', {}, { limit: 100 }, {
          serviceId: 'auth-ai-service',
          apiKey: this.serviceToken?.apiKey || this.serviceToken,
          operation: 'resendEmailVerification',
          practiceId: 'global'  // Practices are stored in the global database
        });
        
        for (const practice of practices) {
          // Convert practice._id to string if it's an object
          const practiceIdStr = practice._id && practice._id.toString ? practice._id.toString() : practice._id;
          
          const practiceContext = {
            serviceId: 'auth-ai-service',
            apiKey: this.serviceToken?.apiKey || this.serviceToken,
            operation: 'resendEmailVerification',
            practiceId: practice.subdomain,  // Use subdomain for database access
            practiceSubdomain: practice.subdomain  // Pass subdomain for user queries
          };
          
          const users = await SecureDataAccess.query('users', 
            { email: email.toLowerCase() }, 
            { limit: 1 }, 
            practiceContext
          );
          
          if (users && users.length > 0) {
            userFound = true;
            userPractice = practice;
            userData = users[0];
            break;
          }
        }
      }
      
      if (!userFound) {
        return {
          success: false,
          message: language === 'he'
            ? `לא נמצא משתמש עם האימייל: ${email}`
            : `No user found with email: ${email}`
        };
      }
      
      // Store new verification token
      const verificationData = {
        email: email.toLowerCase(),
        userId: userData._id,
        token: verificationToken,
        isUsed: false,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reason: reason || 'Resend requested'
      };
      
      await SecureDataAccess.insert('emailverifications', verificationData, {
        serviceId: 'auth-ai-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'resendEmailVerification',
        practiceId: userPractice.subdomain
      });
      
      // Send verification email with correct parameters
      await emailService.sendEmailVerification(
        email,
        verificationToken,
        userData._id,           // userId for the verification URL
        userPractice.name,        // Practice name for email display
        userPractice.subdomain    // Subdomain for URL construction
      );
      
      return {
        success: true,
        message: language === 'he'
          ? `✅ אימייל אימות נשלח מחדש לכתובת: ${email}\n\nבדוק את תיבת הדואר הנכנס שלך ולחץ על הקישור לאימות החשבון.`
          : `✅ Email verification resent to: ${email}\n\nPlease check your inbox and click the verification link to activate your account.`
      };
      
    } catch (error) {
      console.error('❌ [Auth AI] Error resending email verification:', error);
      
      // Provide user-friendly messages for common errors
      if (error.message && error.message.includes('Practice ID required')) {
        return {
          success: false,
          message: language === 'he'
            ? 'עליך להתחבר תחילה למרפאה שלך לפני שליחת אימייל אימות מחדש. אנא בקר בכתובת המרפאה שלך.'
            : 'You need to log in to your practice first before resending email verification. Please visit your practice URL.'
        };
      }
      
      if (error.message && error.message.includes('SECURITY')) {
        return {
          success: false,
          message: language === 'he'
            ? 'לא ניתן לבצע פעולה זו כרגע. אנא נסה להתחבר תחילה או פנה לתמיכה.'
            : 'Unable to perform this action right now. Please try logging in first or contact support.'
        };
      }
      
      // Generic error message
      return {
        success: false,
        message: language === 'he'
          ? 'אירעה שגיאה בשליחת אימייל האימות. אנא נסה שוב מאוחר יותר.'
          : 'An error occurred while resending the verification email. Please try again later.'
      };
    }
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize dependencies first
      await secureConfigService.initialize();
      
      // Auth AI should use API mode for now (auth functions not in MCP yet)
      // Comment out MCP for auth until we add auth functions to MCP server
      // console.log('🔄 [Auth AI] Initializing MCP Bridge...');
      // await mcpBridge.initialize();
      // const stats = mcpBridge.getStats();
      // console.log(`🤖 [Auth AI] Using ${stats.mode} mode for authentication`);
      
      // Get API key directly from KMS (to avoid double encryption issue)
      const productionKMS = require('./productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      
      const apiKey = await productionKMS.getInternalKey('ANTHROPIC_API_KEY') || await productionKMS.getInternalKey('CLAUDE_API_KEY');
      if (!apiKey) {
        throw new Error('No Claude/Anthropic API key found in KMS. Please store ANTHROPIC_API_KEY or CLAUDE_API_KEY.');
      }
      
      // Initialize Anthropic client with API key from KMS
      this.anthropic = new Anthropic({
        apiKey: apiKey
      });
      
      // Authenticate service account
      this.serviceToken = await serviceAccountManager.authenticate('auth-ai-service');
      
      this.initialized = true;
      console.log('✅ [Auth AI Service] Initialized successfully with Claude API');
    } catch (error) {
      console.error('❌ [Auth AI Service] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Setup MongoDB permissions for a new practice database
   * This grants the app user permissions to the practice-specific database
   */
  async setupPracticeDatabasePermissions(practiceSubdomain) {
    const dbName = `intellicare_practice_${practiceSubdomain}`;
    console.log(`🔐 [Auth AI] Setting up MongoDB permissions for: ${dbName}`);

    try {
      // Import MongoDB client
      const { MongoClient } = require('mongodb');

      // Get MongoDB credentials from KMS
      const productionKMS = require('./productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }

      const adminUsername = await productionKMS.getInternalKey('MONGODB_ADMIN_USERNAME') || 'intellicare_admin';
      const adminPassword = await productionKMS.getInternalKey('MONGODB_ADMIN_PASSWORD') || 'CHANGE_ME_PASSWORD';
      const appUsername = await productionKMS.getInternalKey('MONGODB_APP_USERNAME') || 'intellicare_app';

      // Connect as admin to grant permissions
      const adminUri = `mongodb://${adminUsername}:${adminPassword}@localhost:27017/admin?authSource=admin&replicaSet=rs0`;
      const client = new MongoClient(adminUri);

      await client.connect();
      console.log('✅ [Auth AI] Connected to MongoDB as admin');

      const adminDb = client.db('admin');

      // Grant permissions to app user for the new practice database
      await adminDb.command({
        grantRolesToUser: appUsername,
        roles: [
          { role: 'readWrite', db: dbName },
          { role: 'dbAdmin', db: dbName }
        ]
      });

      console.log(`✅ [Auth AI] Granted permissions for ${appUsername} on ${dbName}`);

      // Switch to the new practice database and create collections
      const practiceDb = client.db(dbName);

      // Create required collections
      const collections = [
        'users',
        'patients',
        'appointments',
        'documents',
        'chat_sessions',
        'chat_messages',
        'audit_logs'
      ];

      for (const collectionName of collections) {
        try {
          await practiceDb.createCollection(collectionName);
          console.log(`✅ [Auth AI] Created collection: ${collectionName}`);
        } catch (err) {
          // Collection might already exist, that's fine
          if (err.code !== 48) { // 48 = NamespaceExists
            console.warn(`⚠️ [Auth AI] Could not create collection ${collectionName}:`, err.message);
          }
        }
      }

      await client.close();
      console.log(`✅ [Auth AI] Database setup complete for ${dbName}`);

    } catch (error) {
      console.error(`❌ [Auth AI] Failed to setup permissions for ${dbName}:`, error);
      // Don't throw - we'll try to continue and let MongoDB auto-create on first write
      // Some environments might have different permission models
      console.warn(`⚠️ [Auth AI] Continuing without explicit permissions - MongoDB may auto-configure`);
    }
  }
}

module.exports = new AuthAIService();