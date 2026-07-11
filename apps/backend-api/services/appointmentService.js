/**
 * AppointmentService
 *
 * Domain: appointment
 * Extracted from: agentServiceV4.js
 * Functions: 13
 *
 * Purpose: Handle all appointment-related operations including scheduling and reminders
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations (no HTTP calls)
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const { ObjectId } = require('mongodb');
const availabilityService = require('./availabilityService');
const patientService = require('./patientService');

class AppointmentService {
  constructor() {
    this.serviceName = 'appointmentService';
    this.serviceAuth = null;
  }

  /**
   * Initialize service with authentication
   */
  async initialize() {
    if (!this.serviceAuth) {
      this.serviceAuth = await serviceAccountManager.authenticate(this.serviceName);
      console.log(`✅ ${this.serviceName} authenticated successfully`);
    }
    return this.serviceAuth;
  }

  /**
   * Create secure context for database operations
   * @param {Object} practiceContext - Practice context from request
   * @param {string} operation - Operation name
   * @returns {Object} Security context
   */
  createSecureContext(practiceContext, operation) {
    return {
      serviceId: this.serviceName,
      operation: operation,
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId || practiceContext?.id || 'global',
      apiKey: this.serviceAuth?.apiKey || this.serviceAuth
    };
  }

  /**
   * Normalize practice context to ensure consistent format
   * @param {Object} practiceContext - Raw practice context
   * @returns {Object} Normalized practice context
   */
  normalizePracticeContext(practiceContext) {
    if (!practiceContext) {
      return { id: 'global', subdomain: 'global' };
    }

    return {
      id: practiceContext.practiceId || practiceContext.id || 'global',
      subdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || 'global',
      name: practiceContext.name || practiceContext.practiceName,
      language: practiceContext.language || 'en'
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Lookup provider by name, email, or ID
   * @param {string} nameOrEmailOrId - Provider identifier
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session object
   * @returns {Promise<Object>} Provider info with providerId and providerName
   */
  async lookupDoctor(nameOrEmailOrId, practiceContext, session) {
    try {
      console.log(`🔍 Looking up provider: "${nameOrEmailOrId}"`);

      // Initialize service if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      const context = this.createSecureContext(practiceContext, 'lookup_provider');

      // Check if it's already a provider ID
      if (nameOrEmailOrId && nameOrEmailOrId.startsWith('PROV-')) {
        // Try to find provider by providerId to get full info
        const providers = await SecureDataAccess.query(
          'users',
          { 'providerInfo.providerId': nameOrEmailOrId },
          { limit: 1 },
          context
        );

        if (providers && providers.length > 0) {
          const provider = providers[0];
          return {
            providerId: provider.providerInfo.providerId,
            providerName: provider.providerInfo.name ||
                         `${provider.firstName} ${provider.lastName}`.trim() ||
                         provider.email
          };
        }

        // If not found, return the ID as-is (might be valid)
        return {
          providerId: nameOrEmailOrId,
          providerName: 'Provider' // Generic name
        };
      }

      // Search by email or name
      const query = {};

      // Add provider role filter
      query['providerInfo.providerId'] = { $exists: true };

      // Check if it's an email
      if (nameOrEmailOrId && nameOrEmailOrId.includes('@')) {
        query.email = nameOrEmailOrId.toLowerCase();
      } else {
        // Check if the search term contains a space (indicating full name)
        const nameParts = nameOrEmailOrId.trim().split(/\s+/);

        if (nameParts.length >= 2) {
          // Full name provided (e.g., "Eran Gross")
          // Search for providers where firstName matches first part AND lastName matches last part
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' '); // Handle multi-word last names

          console.log(`🔍 Searching for full name: firstName="${firstName}" lastName="${lastName}"`);

          query.$or = [
            // Match in profile fields (firstName AND lastName)
            {
              $and: [
                { 'profile.firstName': new RegExp(firstName, 'i') },
                { 'profile.lastName': new RegExp(lastName, 'i') }
              ]
            },
            // Match in top-level fields (firstName AND lastName)
            {
              $and: [
                { firstName: new RegExp(firstName, 'i') },
                { lastName: new RegExp(lastName, 'i') }
              ]
            },
            // Match in fullName field (exact full name)
            { fullName: new RegExp(nameOrEmailOrId, 'i') },
            // Match in providerInfo.name (exact full name)
            { 'providerInfo.name': new RegExp(nameOrEmailOrId, 'i') }
          ];
        } else {
          // Single name provided - could be first name, last name, or provider name
          console.log(`🔍 Searching for single name: "${nameOrEmailOrId}"`);

          query.$or = [
            { 'providerInfo.name': new RegExp(nameOrEmailOrId, 'i') },
            { 'profile.firstName': new RegExp(nameOrEmailOrId, 'i') },
            { 'profile.lastName': new RegExp(nameOrEmailOrId, 'i') },
            { firstName: new RegExp(nameOrEmailOrId, 'i') },
            { lastName: new RegExp(nameOrEmailOrId, 'i') },
            { fullName: new RegExp(nameOrEmailOrId, 'i') }
          ];
        }
      }

      const providers = await SecureDataAccess.query(
        'users',
        query,
        { limit: 5 },
        context
      );

      if (!providers || providers.length === 0) {
        // FALLBACK: Check if this is a specialty/role request (e.g., "Clinical Pharmacist", "Cardiologist")
        // In this case, return ANY available provider to allow appointment scheduling
        console.log(`⚠️  No provider found with name "${nameOrEmailOrId}". Checking if this is a specialty/role...`);

        // List of common specialties/roles that don't map to specific providers
        const specialtyKeywords = ['pharmacist', 'cardiologist', 'nurse', 'therapist', 'counselor', 'specialist'];
        const isSpecialtyRequest = specialtyKeywords.some(keyword =>
          nameOrEmailOrId.toLowerCase().includes(keyword)
        );

        if (isSpecialtyRequest) {
          console.log(`✅ Detected specialty/role request: "${nameOrEmailOrId}".`);

          // STEP 1: Try to find a provider with matching specialty (if it's in the schema)
          // Map common specialty terms to schema enum values
          const specialtyMap = {
            'cardiologist': 'cardiology',
            'gastroenterologist': 'gastroenterology',
            'neurologist': 'neurology',
            'dermatologist': 'dermatology',
            'psychiatrist': 'psychiatry',
            // Add more mappings as needed
          };

          // Levenshtein distance function for fuzzy matching
          const levenshteinDistance = (str1, str2) => {
            const m = str1.length;
            const n = str2.length;
            const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

            for (let i = 0; i <= m; i++) dp[i][0] = i;
            for (let j = 0; j <= n; j++) dp[0][j] = j;

            for (let i = 1; i <= m; i++) {
              for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                  dp[i][j] = dp[i - 1][j - 1];
                } else {
                  dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
              }
            }
            return dp[m][n];
          };

          // Calculate similarity score (0-1, higher is better)
          const similarity = (str1, str2) => {
            const distance = levenshteinDistance(str1, str2);
            const maxLength = Math.max(str1.length, str2.length);
            return maxLength === 0 ? 1 : 1 - distance / maxLength;
          };

          const searchTerm = nameOrEmailOrId.toLowerCase();
          let matchedSpecialty = null;
          let bestMatch = { term: null, score: 0 };

          // Check if the search term matches any specialty (exact or fuzzy)
          for (const [term, specialty] of Object.entries(specialtyMap)) {
            // Try exact substring match first
            if (searchTerm.includes(term)) {
              matchedSpecialty = specialty;
              console.log(`✅ Exact match found: "${term}" → "${specialty}"`);
              break;
            }

            // Try fuzzy matching with 80% similarity threshold
            const score = similarity(searchTerm, term);
            if (score > bestMatch.score) {
              bestMatch = { term, specialty, score };
            }
          }

          // If no exact match but fuzzy match is good enough (>= 0.80)
          if (!matchedSpecialty && bestMatch.score >= 0.80) {
            matchedSpecialty = bestMatch.specialty;
            console.log(`✅ Fuzzy match found: "${searchTerm}" ≈ "${bestMatch.term}" (${(bestMatch.score * 100).toFixed(0)}% similar) → "${matchedSpecialty}"`);
          }

          // Try to find provider by specialty
          if (matchedSpecialty) {
            console.log(`🔍 Searching for provider with specialty: ${matchedSpecialty}`);
            const specialtyProviders = await SecureDataAccess.query(
              'users',
              { 'providerInfo.specialties': matchedSpecialty },
              { limit: 1 },
              context
            );

            if (specialtyProviders && specialtyProviders.length > 0) {
              console.log(`✅ Found provider with specialty: ${specialtyProviders[0].providerInfo?.name || specialtyProviders[0].fullName}`);
              return specialtyProviders[0];
            }
          }

          // STEP 2: Use the current logged-in user (most common case - you're the provider)
          console.log(`📋 No specialty match. Using current user as provider.`);
          if (practiceContext.userId) {
            const currentUser = await SecureDataAccess.query(
              'users',
              { _id: practiceContext.userId },
              { limit: 1 },
              context
            );

            if (currentUser && currentUser.length > 0) {
              console.log(`✅ Using current user: ${currentUser[0].providerInfo?.name || currentUser[0].fullName || 'Current User'}`);
              return currentUser[0];
            }
          }

          // STEP 3: Fallback to Dr. Eran Gross (system default provider)
          console.log(`📋 Trying default provider: Dr. Eran Gross`);
          const defaultProvider = await SecureDataAccess.query(
            'users',
            { email: 'eran@gross.support' },
            { limit: 1 },
            context
          );

          if (defaultProvider && defaultProvider.length > 0) {
            console.log(`✅ Using default provider: Dr. Eran Gross`);
            return defaultProvider[0];
          }

          // STEP 4: Final fallback - Get any available doctor
          console.log(`📋 Final fallback - searching for any doctor`);
          const anyProvider = await SecureDataAccess.query(
            'users',
            { roles: 'doctor' },
            { limit: 1 },
            context
          );

          if (anyProvider && anyProvider.length > 0) {
            console.log(`✅ Final fallback - Using first available doctor: ${anyProvider[0].providerInfo?.name || anyProvider[0].fullName || 'Unknown'}`);
            return anyProvider[0];
          }
        }

        // If still no provider found, use Dr. Eran Gross as absolute fallback
        console.log(`⚠️ No provider found with name "${nameOrEmailOrId}". Using system default.`);
        const absoluteFallback = await SecureDataAccess.query(
          'users',
          { email: 'eran@gross.support' },
          { limit: 1 },
          context
        );

        if (absoluteFallback && absoluteFallback.length > 0) {
          console.log(`✅ Using absolute fallback: Dr. Eran Gross`);
          return absoluteFallback[0];
        }

        // Only throw error if even Dr. Eran Gross is not found
        const errorMsg = practiceContext.language === 'he'
          ? `לא נמצא רופא: ${nameOrEmailOrId}`
          : `Provider not found: ${nameOrEmailOrId}. System default provider is also unavailable.`;
        throw new Error(errorMsg);
      }

      // If multiple matches, prefer exact matches
      let selectedProvider = providers[0];

      if (providers.length > 1) {
        // Try exact name match first
        const exactMatch = providers.find(p => {
          // Check both top-level and profile-nested fields
          const fullName = p.profile?.firstName && p.profile?.lastName
            ? `${p.profile.firstName} ${p.profile.lastName}`.trim().toLowerCase()
            : `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
          const providerName = p.providerInfo?.name?.toLowerCase();
          const searchTerm = nameOrEmailOrId.toLowerCase();
          return fullName === searchTerm || providerName === searchTerm;
        });

        if (exactMatch) {
          selectedProvider = exactMatch;
        }
      }

      // Extract provider name from profile or top-level fields
      const firstName = selectedProvider.profile?.firstName || selectedProvider.firstName || '';
      const lastName = selectedProvider.profile?.lastName || selectedProvider.lastName || '';
      const providerName = selectedProvider.providerInfo?.name ||
                          `${firstName} ${lastName}`.trim() ||
                          selectedProvider.email;

      console.log(`✅ Found provider: ${providerName} (${selectedProvider.providerInfo.providerId})`);

      return {
        providerId: selectedProvider.providerInfo.providerId,
        providerName: providerName
      };

    } catch (error) {
      console.error(`❌ Error looking up provider "${nameOrEmailOrId}":`, error.message);
      throw error;
    }
  }

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

async scheduleAppointment(params, practiceContext, session) {
    try {
      // Extract patientId and handle patient lookup
      let { patientId, nationalId, patientName, providerId, providerName, doctor, ...appointmentData } = params;

      // Extract SSN from text if patientId contains descriptive text like "Name (SSN: ###-##-####)"
      if (patientId && typeof patientId === 'string') {
        // Check for SSN pattern in parentheses
        const ssnMatch = patientId.match(/\(SSN:\s*(\d{3}-\d{2}-\d{4})\)/i);
        if (ssnMatch) {
          console.log(`📝 Extracted SSN from text: ${ssnMatch[1]}`);
          // Extract name part (everything before the parentheses)
          const nameMatch = patientId.match(/^([^(]+)/);
          if (nameMatch) {
            patientName = nameMatch[1].trim();
            console.log(`📝 Extracted patient name: ${patientName}`);
          }
          patientId = ssnMatch[1]; // Use the extracted SSN as patientId
        }
        // Also check if patientId is just text with SSN at the end
        else if (patientId.match(/\d{3}-\d{2}-\d{4}$/)) {
          const parts = patientId.match(/^(.*?)(\d{3}-\d{2}-\d{4})$/);
          if (parts) {
            patientName = parts[1].trim();
            patientId = parts[2];
            console.log(`📝 Extracted SSN ${patientId} and name ${patientName} from text`);
          }
        }
      }

      console.log('📋 scheduleAppointment params:', {
        providerId,
        providerName,
        doctor,
        hasProviderId: !!providerId,
        providerIdType: typeof providerId
      });

      // SMART DEFAULT: If current user is a doctor/provider and no provider specified, use them
      if (!providerId && !providerName && !doctor) {
        const currentUser = practiceContext?.currentUser;
        if (currentUser?.isProvider && currentUser?.providerId) {
          console.log(`💡 Smart default: Using current user ${currentUser.fullName} as provider`);
          providerId = currentUser.providerId;
          providerName = currentUser.fullName || `${currentUser.firstName} ${currentUser.lastName}`.trim();
        } else if (currentUser?.roles?.some(role => ['doctor', 'doctor_specialist', 'nurse', 'nurse_rn', 'nurse_lpn', 'provider'].includes(role))) {
          // User is a provider by role but might not have providerId set yet
          console.log(`💡 Current user is a ${currentUser.roles[0]} - using them as provider`);
          // Use existing provider ID from providerInfo or generate based on user name
          providerId = currentUser.providerInfo?.providerId || currentUser.providerId ||
                      `PROV-${currentUser.firstName?.toLowerCase()}-${currentUser.lastName?.toLowerCase()}`.replace(/\s+/g, '-');
          providerName = currentUser.fullName || `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email;
          console.log(`📌 Using generated provider ID: ${providerId} for ${providerName}`);
          // Skip lookup since we have what we need
        }
      }

      // Handle provider lookup if name is provided instead of ID
      // Also check if provider ID was mistakenly passed as providerName
      if (!providerId && (providerName || doctor)) {
        const nameOrId = providerName || doctor;
        // Check if what we have is actually a provider ID
        if (nameOrId && nameOrId.startsWith('PROV-')) {
          console.log('⚠️ Provider ID passed as providerName, fixing...');
          providerId = nameOrId;
          providerName = 'Provider'; // Will be updated if we find the actual name
        } else {
          const providerInfo = await this.lookupDoctor(nameOrId, practiceContext, session);
          providerId = providerInfo.providerId;
          providerName = providerInfo.providerName;
        }
      }
      
      // Priority: Use nationalId if provided
      if (nationalId && !patientId) {
        console.log(`🔍 Looking up patient by National ID for appointment: ${nationalId}`);
        const searchResult = await patientService.searchPatients({
          query: nationalId
        }, practiceContext, session);
        
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const patient = searchResult.data[0];
          patientId = patient._id;
          patientName = `${patient.firstName} ${patient.lastName}`;
          console.log(`✅ Found patient for appointment: ${patientName}`);
        } else {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצא מטופל עם תעודת זהות ${nationalId}` 
            : `No patient found with ID ${nationalId}`);
        }
      }
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        patientName = session.currentContext.patientName;
        console.log(`🎯 Using context patient: ${patientName} (${patientId})`);
      }
      
      // Check if patientId looks like a US SSN (###-##-####) instead of MongoDB ObjectId
      if (patientId && /^\d{3}-\d{2}-\d{4}$/.test(patientId)) {
        console.log(`⚠️ Patient ID looks like SSN: ${patientId}, searching...`);
        const searchResult = await patientService.searchPatients({
          query: patientId
        }, practiceContext, session);

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const patient = searchResult.data[0];
          nationalId = patientId; // Save the SSN
          patientId = patient._id; // Use the actual MongoDB ID
          patientName = `${patient.firstName} ${patient.lastName}`;
          console.log(`✅ Found patient by SSN: ${patientName} (${patientId})`);
        } else {
          throw new Error(practiceContext.language === 'he'
            ? `לא נמצא מטופל עם מספר ביטוח לאומי ${patientId}`
            : `No patient found with SSN ${patientId}`);
        }
      }

      // Check if patientId looks like a National ID (9 digits) instead of MongoDB ObjectId
      if (patientId && /^\d{9}$/.test(patientId)) {
        console.log(`⚠️ Patient ID looks like National ID: ${patientId}, searching...`);
        const searchResult = await patientService.searchPatients({
          query: patientId
        }, practiceContext, session);

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const patient = searchResult.data[0];
          nationalId = patientId; // Save the national ID
          patientId = patient._id; // Use the actual MongoDB ID
          patientName = `${patient.firstName} ${patient.lastName}`;
          console.log(`✅ Found patient by National ID: ${patientName} (${patientId})`);
        } else {
          throw new Error(practiceContext.language === 'he'
            ? `לא נמצא מטופל עם תעודת זהות ${patientId}`
            : `No patient found with ID ${patientId}`);
        }
      }

      // Check if patientId looks like an MRN (e.g., MET-2025-5547) instead of MongoDB ObjectId
      if (patientId && typeof patientId === 'string' && !patientId.match(/^[0-9a-fA-F]{24}$/)) {
        // Not an ObjectId - could be MRN, name, or other identifier
        console.log(`⚠️ Patient ID is not ObjectId format: ${patientId}, searching by name/MRN...`);
        const searchResult = await patientService.searchPatients({
          query: patientId
        }, practiceContext, session);

        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          const patient = searchResult.data[0];
          const originalId = patientId; // Save the original identifier
          patientId = patient._id; // Use the actual MongoDB ID
          patientName = `${patient.firstName} ${patient.lastName}`;
          console.log(`✅ Found patient by name/MRN "${originalId}": ${patientName} (${patientId})`);
        } else {
          throw new Error(practiceContext.language === 'he'
            ? `לא נמצא מטופל: ${patientId}`
            : `No patient found matching: ${patientId}`);
        }
      }

      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
          : 'Patient ID required. Please search for a patient first');
      }
      
      // Direct database access for appointments if available
      console.log('🔍 Checking models availability:', {
        hasModels: !!practiceContext.models,
        hasAppointment: !!practiceContext.models?.Appointment,
        hasPatient: !!practiceContext.models?.Patient
      });
      
      if (practiceContext.models?.Appointment && practiceContext.models?.Patient) {
        const { Appointment, Patient } = practiceContext.models;
        console.log('✅ Using direct database access for appointment creation');
        
        // Get patient details if not already fetched
        if (!patientName && patientId) {
          // Only validate ObjectId format if we have a patientId that hasn't been resolved yet
          // (SSN/National ID lookups would have already set patientName)
          if (!patientId.match(/^[0-9a-fA-F]{24}$/)) {
            console.error(`❌ Invalid patient ID format: ${patientId}`);
            throw new Error(practiceContext.language === 'he'
              ? `מזהה מטופל לא תקין: ${patientId}`
              : `Invalid patient ID format: ${patientId}`);
          }
          // Ensure we have a valid service token
          if (!this.serviceToken || !this.serviceToken.apiKey) {
            console.log('⚠️ Service token missing or invalid, re-authenticating...');
            const serviceAccountManager = require('./serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate('agentServiceV4');
          }

          const queryContext = {
            serviceId: this.serviceName,
            operation: 'scheduleAppointment-getPatient',
            practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || (() => {
              console.error('❌ Practice subdomain missing in appointments! practiceContext:', practiceContext);
              throw new Error('Practice context is required for appointments');
            })(),
            apiKey: this.serviceAuth?.apiKey || this.serviceToken
          };
          const patients = await SecureDataAccess.query('patients', { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId }, {
            limit: 1,
            projection: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              phone: 1,
              email: 1
            }
          }, queryContext);
          const patient = patients && patients[0];
          if (patient) {
            patientName = `${patient.firstName} ${patient.lastName}`;
            appointmentData.patientPhone = appointmentData.patientPhone || patient.phone;
            appointmentData.patientEmail = appointmentData.patientEmail || patient.email;
          }
        }
        
        // Parse date and time - handle DD/MM/YYYY format and Hebrew terms
        let scheduledDate;
        const dateStr = params.date || params.appointmentDate || appointmentData.scheduledDateTime || appointmentData.scheduledDate || appointmentData.appointmentDate;
        
        console.log('📅 Parsing appointment date:', {
          dateStr: dateStr,
          type: typeof dateStr,
          params_date: params.date,
          params_appointmentDate: params.appointmentDate
        });
        
        if (typeof dateStr === 'string') {
          // Handle Hebrew date terms
          if (dateStr.includes('מחר') || dateStr.toLowerCase().includes('tomorrow')) {
            scheduledDate = new Date();
            scheduledDate.setDate(scheduledDate.getDate() + 1);
            scheduledDate.setHours(0, 0, 0, 0); // Set to midnight
            console.log('📅 Parsed as tomorrow:', scheduledDate);
          } else if (dateStr.includes('היום') || dateStr.toLowerCase().includes('today')) {
            scheduledDate = new Date();
            scheduledDate.setHours(0, 0, 0, 0); // Set to midnight
            console.log('📅 Parsed as today:', scheduledDate);
          } else if (dateStr.includes('/')) {
            // Convert DD/MM/YYYY to YYYY-MM-DD
            const [day, month, year] = dateStr.split('/');
            // Use UTC to avoid timezone issues
            scheduledDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0));
            console.log(`📅 Parsed DD/MM/YYYY: ${day}/${month}/${year} -> ${scheduledDate.toISOString()}`);
          } else {
            scheduledDate = new Date(dateStr);
            console.log('📅 Parsed as ISO date:', scheduledDate);
          }
        } else {
          scheduledDate = new Date(dateStr);
          console.log('📅 Parsed non-string date:', scheduledDate);
        }
        
        const scheduledTime = params.time || params.appointmentTime || appointmentData.scheduledTime || appointmentData.appointmentTime || '10:00';
        const duration = appointmentData.duration || params.duration || 30;
        
        // Generate proper appointment number using queue management
        const queueManagement = require('./queueManagementService');
        // Initialize queueManagement service if not already initialized
        if (!queueManagement.initialized) {
          await queueManagement.initialize();
        }
        const appointmentNumber = await queueManagement.generateAppointmentNumber(
          practiceContext.practiceId,
          scheduledDate,
          practiceContext.models  // Pass models to check existing appointments
        );

        // Validate appointmentNumber was generated successfully
        if (!appointmentNumber) {
          const errorMsg = practiceContext.language === 'he'
            ? 'שגיאה ביצירת מספר תור'
            : 'Failed to generate appointment number';
          console.error('❌ appointmentNumber is null or undefined');
          throw new Error(errorMsg);
        }

        console.log(`✅ Appointment number generated: ${appointmentNumber}`);

        // Initialize availability service if not already initialized
        if (!availabilityService.initialized) {
          await availabilityService.initialize();
        }
        // Use availability service to reserve slot with optimistic locking
        const reservationResult = await availabilityService.reserveSlot(
          providerId,
          scheduledDate.toISOString().split('T')[0],
          scheduledTime,
          duration,
          practiceContext
        );
        
        if (!reservationResult.success) {
          // Handle different error types
          let errorMessage;
          
          if (reservationResult.error === 'SLOT_LOCKED') {
            errorMessage = practiceContext.language === 'he'
              ? `זמן זה נתפס כרגע על ידי משתמש אחר. אנא נסה שוב או בחר זמן אחר`
              : `This time slot is being booked by another user. Please try again or choose another time`;
          } else if (reservationResult.error === 'SLOT_TAKEN') {
            console.log(`⚠️ Conflict detected: Provider ${providerId} already has appointment at ${scheduledTime}`);
            
            // Try to find the next available slot
            const availableSlotsResult = await this.findAvailableSlots({
              providerId: providerId,
              date: scheduledDate.toISOString().split('T')[0],
              duration: duration
            }, practiceContext, session);
            
            let suggestedTime = null;
            if (availableSlotsResult.success && availableSlotsResult.data.length > 0) {
              // Find the closest available time after the requested time
              const requestedHour = parseInt(scheduledTime.split(':')[0]);
              const requestedMinute = parseInt(scheduledTime.split(':')[1]);
              const requestedMinutes = requestedHour * 60 + requestedMinute;
              
              for (const slot of availableSlotsResult.data) {
                const slotHour = parseInt(slot.time.split(':')[0]);
                const slotMinute = parseInt(slot.time.split(':')[1]);
                const slotMinutes = slotHour * 60 + slotMinute;
                
                if (slotMinutes >= requestedMinutes) {
                  suggestedTime = slot.time;
                  break;
                }
              }
              
              // If no time after requested, take the first available
              if (!suggestedTime && availableSlotsResult.data.length > 0) {
                suggestedTime = availableSlotsResult.data[0].time;
              }
            }
            
            errorMessage = practiceContext.language === 'he' 
              ? `הרופא תפוס בשעה ${scheduledTime}. ${suggestedTime ? `זמן מוצע: ${suggestedTime}` : 'אנא בחר זמן אחר'}`
              : `Doctor is busy at ${scheduledTime}. ${suggestedTime ? `Suggested time: ${suggestedTime}` : 'Please choose another time'}`;
            
            return {
              success: false,
              conflict: true,
              suggestedTime: suggestedTime,
              availableSlots: availableSlotsResult.data || [],
              message: errorMessage
            };
          } else {
            errorMessage = reservationResult.message || 
              (practiceContext.language === 'he' ? 'שגיאה בקביעת התור' : 'Error scheduling appointment');
          }
          
          return {
            success: false,
            message: errorMessage
          };
        }
        
        // Slot is reserved, now create the appointment
        let savedAppointment;
        try {
          // Create appointment
          const appointment = new Appointment({
            patientId: patientId,
            patientName: patientName,
            patientPhone: appointmentData.patientPhone,
            patientEmail: appointmentData.patientEmail,
            appointmentNumber: appointmentNumber,
            appointmentType: appointmentData.appointmentType || 'consultation',
            appointmentReason: appointmentData.reason || appointmentData.appointmentReason || 'General consultation',
            notes: appointmentData.notes,
            scheduledDate: scheduledDate,
            scheduledTime: scheduledTime,
            duration: duration,
            timezone: appointmentData.timezone || 'Asia/Jerusalem',
            providerId: providerId,
            providerEmail: practiceContext.user?.email || appointmentData.providerEmail, // Add provider email for easier searching
            providerName: providerName || appointmentData.providerName || 'Provider',
            providerType: appointmentData.providerType || 'doctor',
            department: appointmentData.department,
            room: appointmentData.room,
            status: 'scheduled',
            priority: appointmentData.priority === 'normal' ? 'routine' : (appointmentData.priority || 'routine'),
            createdBy: 'Agent',
            practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId
          });
          
          console.log('💾 Attempting to save appointment:', {
            patientId: appointment.patientId,
            patientName: appointment.patientName,
            scheduledTime: appointment.scheduledTime,
            providerId: appointment.providerId
          });
          
          // Try to save with retry logic for duplicate appointment numbers
          let retryCount = 0;
          const maxRetries = 5;

          // Define context for SecureDataAccess
          const context = {
            serviceId: this.serviceName,
            operation: 'scheduleAppointment-saveAppointment',
            practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId || (() => {
              console.error('❌ Practice ID missing in appointments save! practiceContext:', practiceContext);
              throw new Error('Practice context is required for saving appointments');
            })(),
            practiceSubdomain: practiceContext.subdomain || practiceContext.practiceSubdomain || (() => {
              console.error('❌ Practice subdomain missing in appointment save! practiceContext:', practiceContext);
              throw new Error('Practice subdomain is required for saving appointments');
            })(),
            apiKey: this.serviceAuth?.apiKey || this.serviceToken
          };

          while (retryCount < maxRetries) {
            try {
              // Use insert for new appointments (not update)
              savedAppointment = await SecureDataAccess.insert('appointments', appointment.toObject ? appointment.toObject() : appointment, {
    ...context
  });
              console.log('✅ Appointment saved successfully:', {
                id: savedAppointment._id,
                appointmentNumber: savedAppointment.appointmentNumber
              });
              break; // Success - exit the retry loop
            } catch (saveError) {
              if (saveError.code === 11000 && saveError.keyPattern?.appointmentNumber) {
                // Duplicate appointment number - generate a new one
                retryCount++;
                console.log(`⚠️ Duplicate appointment number ${appointment.appointmentNumber}, generating new one (attempt ${retryCount}/${maxRetries})`);
                
                // Generate a new appointment number with retry counter
                const newAppointmentNumber = await queueManagement.generateAppointmentNumber(
                  practiceContext.practiceId, 
                  scheduledDate,
                  practiceContext.models
                );
                appointment.appointmentNumber = newAppointmentNumber;
                
                if (retryCount >= maxRetries) {
                  throw new Error(`Failed to generate unique appointment number after ${maxRetries} attempts`);
                }
              } else {
                // Other error - throw it
                throw saveError;
              }
            }
          }
          
          // Send real-time notification to doctor via WebSocket
          if (global.io && savedAppointment) {
            try {
              // Log the provider ID being used for notifications
              console.log(`🔔 Emitting to doctor_${providerId} room`);
              console.log(`🔔 Provider details: ID=${providerId}, Name=${providerName}`);

              // Notify the specific doctor
              global.io.to(`doctor_${providerId}`).emit('new_appointment', {
                appointmentId: savedAppointment._id,
                appointmentNumber: savedAppointment.appointmentNumber,
                patientName: patientName,
                patientId: patientId,
                scheduledDate: scheduledDate.toISOString(),
                scheduledTime: scheduledTime,
                appointmentType: appointmentData.appointmentType || 'consultation',
                appointmentReason: appointmentData.reason || appointmentData.appointmentReason,
                duration: duration,
                department: appointmentData.department,
                room: appointmentData.room,
                priority: appointmentData.priority || 'routine',
                createdBy: 'AI Agent',
                createdAt: new Date().toISOString(),
                practice: practiceContext.practiceSubdomain || practiceContext.practiceId
              });

              // Log practice emission
              console.log(`🏥 Emitting to practice_${practiceContext.practiceId} room`);

              // Also emit to practice-wide channel for secretaries/admins
              global.io.to(`practice_${practiceContext.practiceId}`).emit('appointment_created', {
                providerId: providerId,
                providerName: providerName,
                patientName: patientName,
                appointmentNumber: savedAppointment.appointmentNumber,
                scheduledDateTime: `${scheduledDate.toLocaleDateString()} ${scheduledTime}`,
                appointmentType: appointmentData.appointmentType || 'consultation',
                department: appointmentData.department,
                createdAt: new Date().toISOString()
              });
              
              console.log(`📢 WebSocket notification sent for appointment ${savedAppointment.appointmentNumber} to doctor ${providerId}`);
            } catch (wsError) {
              console.error('❌ Failed to send WebSocket notification:', wsError);
              // Don't fail the appointment creation if WebSocket fails
            }
          }
          
          // Update provider's user record with the appointment (REQUIRED)
          if (practiceContext.models?.User && providerId) {
            // Find provider by providerId
            let providerUser = null;
            
            // First try to find by providerInfo.providerId (for users with provider role)
            if (providerId.startsWith('PROV-')) {
              const users = await SecureDataAccess.query('users', {
                'providerInfo.providerId': providerId
              }, { limit: 1 }, {
    ...context
  });
              providerUser = users && users[0];
            }
            
            // If not found or providerId is an ObjectId, try finding by _id
            if (!providerUser && providerId && providerId.match(/^[0-9a-fA-F]{24}$/)) {
              const providerObjectId = new ObjectId(providerId);
              const users = await SecureDataAccess.query('users', { _id: providerObjectId }, { limit: 1 }, {
    ...context
  });
              providerUser = users && users[0];
            }
            
            if (!providerUser) {
              // Try one more time with a more flexible search
              console.log(`⚠️ Provider user not found, attempting fallback search for: ${providerId}`);

              // If it looks like PROV-{objectId}, extract the objectId part
              if (providerId.startsWith('PROV-') && providerId.includes('-')) {
                const parts = providerId.split('-');
                const possibleObjectId = parts[parts.length - 1];
                if (possibleObjectId && possibleObjectId.match(/^[0-9a-fA-F]{24}$/)) {
                  const users = await SecureDataAccess.query('users', { _id: new ObjectId(possibleObjectId) }, { limit: 1 }, {
                    ...context
                  });
                  providerUser = users && users[0];
                }
              }

              // If still not found, log a warning but don't crash - the appointment is already saved
              if (!providerUser) {
                console.warn(`⚠️ WARNING: Could not find provider user for ID: ${providerId}. Appointment saved but provider's appointment list not updated.`);
                // Don't throw error - continue with success since appointment is saved
              }
            }
            
            // Add appointment to provider's asProvider array using proper update operators
            if (providerUser) {
              await SecureDataAccess.update('users',
                { _id: providerUser._id },
                {
                  $push: { 'appointments.asProvider': savedAppointment._id },
                  $inc: { 'providerInfo.stats.totalAppointments': 1 }
                },
                context
              );
              console.log(`✅ Updated provider user record for: ${providerUser.email || providerId}`);
            }
          }

          // NOTE: Removed DUAL WRITE to patient.appointments array (November 2025)
          // Appointments are stored in the 'appointments' collection only.
          // getAppointments() queries by patientId - no embedded data needed.
          // This follows proper MongoDB document model (reference pattern).

          // Also check if patient is a user and update their user record
          if (practiceContext.models?.User && patientId) {
            try {
              // Try to find a user with this patient ID
              const users = await SecureDataAccess.query('users', {
                patientId: patientId
              }, { limit: 1 }, {
    ...context
  });
              const patientUser = users && users[0];
              
              if (patientUser) {
                // Add appointment to patient's created array using proper update operators
                await SecureDataAccess.update('users', { _id: patientUser._id }, {
                    $push: { 'appointments.created': savedAppointment._id }
                  }, {
    ...context
  });
                console.log(`✅ Updated patient's user record for: ${patientUser.email}`);
              }
            } catch (updateError) {
              console.error('❌ Error updating patient user record:', updateError);
              // Don't fail the appointment creation, just log the error
            }
          }
          
          // Invalidate availability cache for this provider/date
          availabilityService.invalidateCache(
            providerId,
            scheduledDate.toISOString().split('T')[0],
            practiceContext.practiceId
          );
        } catch (saveError) {
          // Release the slot lock if appointment creation fails
          availabilityService.releaseSlot(
            providerId,
            scheduledDate.toISOString().split('T')[0],
            scheduledTime
          );
          throw saveError;
        }
        
        // Format date properly for display
        const displayDate = scheduledDate.toLocaleDateString('he-IL', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric'
        });
        
        // Prepare appointment details for response
        const appointmentDetails = {
          appointmentId: savedAppointment._id,
          appointmentNumber: savedAppointment.appointmentNumber,
          patientId: savedAppointment.patientId,
          patientName: savedAppointment.patientName,
          patientPhone: savedAppointment.patientPhone,
          patientEmail: savedAppointment.patientEmail,
          providerId: savedAppointment.providerId,
          providerName: savedAppointment.providerName,
          scheduledDate: displayDate,
          scheduledTime: savedAppointment.scheduledTime,
          reminderScheduled: false
        };
        
        // If patient phone exists, prepare reminder info and schedule reminder
        if (savedAppointment.patientPhone) {
          appointmentDetails.reminderInfo = {
            patientPhone: savedAppointment.patientPhone,
            reminderTime: new Date(scheduledDate.getTime() - 30 * 60000).toISOString(), // 30 min before
            reminderMessage: practiceContext.language === 'he'
              ? `תזכורת: יש לך פגישה עם ${savedAppointment.providerName} ב-${displayDate} בשעה ${scheduledTime}`
              : `Reminder: You have an appointment with ${savedAppointment.providerName} on ${displayDate} at ${scheduledTime}`
          };
          
          // Automatically schedule reminder for the appointment
          try {
            console.log('📱 Scheduling automatic appointment reminder for patient phone:', savedAppointment.patientPhone);
            
            // Use SecureDataAccess instead of callAPI
            const scheduleReminderContext = {
              serviceId: this.serviceName,
              operation: 'schedule_reminder',
              practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
              apiKey: this.serviceAuth?.apiKey || this.serviceToken
            };

            const newReminder = await SecureDataAccess.insert(
              'reminders',
              {
                patientId: savedAppointment.patientId,
                reminderType: 'appointment',
                dateTime: scheduledDate.toISOString(),
                appointmentId: savedAppointment._id,  // MongoDB ObjectId for database reference
                appointmentNumber: savedAppointment.appointmentNumber,  // Human-readable number for display
                message: appointmentDetails.reminderInfo.reminderMessage,
                status: 'scheduled',
                createdAt: new Date(),
                updatedAt: new Date()
              },
              scheduleReminderContext
            );

            const reminderResult = { success: true, data: newReminder };
            
            if (reminderResult.success) {
              console.log('✅ Reminder scheduled successfully:', reminderResult.data);
              appointmentDetails.reminderScheduled = true;
              appointmentDetails.reminderId = reminderResult.data?.reminderId;
              // Include the actual reminder send time
              appointmentDetails.reminderWillBeSentAt = reminderResult.data?.willBeSentAt;
              appointmentDetails.reminderAdjustedForSleepingHours = reminderResult.data?.wasAdjustedForSleepingHours;
            } else {
              console.log('⚠️ Could not schedule reminder:', reminderResult.message);
            }
          } catch (reminderError) {
            console.error('❌ Error scheduling reminder:', reminderError);
            // Don't fail the appointment creation if reminder fails
          }
        }
        
        // Format reminder time if available
        let reminderMessage = '';
        if (appointmentDetails.reminderScheduled && appointmentDetails.reminderWillBeSentAt) {
          const reminderDate = new Date(appointmentDetails.reminderWillBeSentAt);
          const reminderDateStr = reminderDate.toLocaleDateString(practiceContext.language === 'he' ? 'he-IL' : 'en-US');
          const reminderTimeStr = reminderDate.toLocaleTimeString(practiceContext.language === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
          
          if (practiceContext.language === 'he') {
            reminderMessage = ` ותזכורת תישלח ב-${reminderDateStr} בשעה ${reminderTimeStr}`;
            if (appointmentDetails.reminderAdjustedForSleepingHours) {
              reminderMessage += ' (הותאמה לשעות פעילות)';
            }
          } else {
            reminderMessage = ` and reminder will be sent on ${reminderDateStr} at ${reminderTimeStr}`;
            if (appointmentDetails.reminderAdjustedForSleepingHours) {
              reminderMessage += ' (adjusted to business hours)';
            }
          }
        }
        
        return {
          success: true,
          data: appointmentDetails,
          message: practiceContext.language === 'he' 
            ? `התור נקבע בהצלחה ל-${displayDate} בשעה ${scheduledTime}${reminderMessage}`
            : `Appointment scheduled successfully for ${displayDate} at ${scheduledTime}${reminderMessage}`
        };
      }
      
      // Fallback to SecureDataAccess if models not available
      const fallbackContext = {
        serviceId: this.serviceName,
        operation: 'create_appointment_fallback',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Parse date for fallback path (same logic as primary path)
      let scheduledDate;
      const dateStr = params.date || params.appointmentDate || appointmentData.scheduledDateTime || appointmentData.scheduledDate || appointmentData.appointmentDate;

      if (typeof dateStr === 'string') {
        if (dateStr.includes('מחר') || dateStr.toLowerCase().includes('tomorrow')) {
          scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + 1);
          scheduledDate.setHours(0, 0, 0, 0);
        } else if (dateStr.includes('היום') || dateStr.toLowerCase().includes('today')) {
          scheduledDate = new Date();
          scheduledDate.setHours(0, 0, 0, 0);
        } else if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          scheduledDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0));
        } else {
          scheduledDate = new Date(dateStr);
        }
      } else {
        scheduledDate = new Date(dateStr);
      }

      // Generate appointment number for fallback path
      const queueManagement = require('./queueManagementService');
      if (!queueManagement.initialized) {
        await queueManagement.initialize();
      }
      const fallbackAppointmentNumber = await queueManagement.generateAppointmentNumber(
        practiceContext.practiceId,
        scheduledDate,
        practiceContext.models
      );

      const newAppointment = await SecureDataAccess.insert(
        'appointments',
        {
          ...params,
          appointmentNumber: fallbackAppointmentNumber,
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        fallbackContext
      );

      return {
        success: true,
        data: newAppointment,
        message: practiceContext.language === 'he'
          ? `התור נקבע בהצלחה ל-${params.date} בשעה ${params.time}`
          : `Appointment scheduled for ${params.date} at ${params.time}`
      };
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בקביעת התור: ${error.message}`
          : `Error scheduling appointment: ${error.message}`
      };
    }
  }

async rescheduleAppointment(params, practiceContext, session) {
    try {
      const { appointmentId, appointmentNumber, newDate, newTime, newProvider, providerId, reason } = params;
      
      if (!appointmentId && !appointmentNumber) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה תור או מספר תור' 
          : 'Appointment ID or number required');
      }
      
      if (!newDate && !newTime) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש תאריך או שעה חדשים' 
          : 'New date or time required');
      }
      
      // Use updateAppointment with specific fields
      const updateResult = await this.updateAppointment({
        appointmentId,
        appointmentNumber,
        scheduledDate: newDate,
        scheduledTime: newTime,
        providerId: providerId,
        providerName: newProvider, // Will be handled by updateAppointment's provider lookup
        notes: reason ? `Rescheduled: ${reason}` : 'Rescheduled'
      }, practiceContext, session);
      
      if (updateResult.success) {
        return {
          ...updateResult,
          message: practiceContext.language === 'he' 
            ? `התור נדחה בהצלחה ל-${newDate || 'אותו תאריך'} בשעה ${newTime || 'אותה שעה'}`
            : `Appointment rescheduled to ${newDate || 'same date'} at ${newTime || 'same time'}`
        };
      }
      
      return updateResult;
      
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בדחיית התור: ${error.message}`
          : `Error rescheduling appointment: ${error.message}`
      };
    }
  }

/**
   * Delete appointment - PERMANENTLY removes the appointment document from database
   * Use this when you want to completely remove an appointment from the system
   * @param {Object} params - { appointmentId, appointmentNumber, deletedBy, reason }
   * @returns {Promise<Object>} Result with success status
   */
  async deleteAppointment(params, practiceContext, session) {
    try {
      const { appointmentId, appointmentNumber, reason } = params;

      if (!appointmentId && !appointmentNumber) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה תור או מספר תור'
          : 'Appointment ID or number required');
      }

      console.log(`🗑️ Attempting to PERMANENTLY DELETE appointment: ID=${appointmentId}, Number=${appointmentNumber}`);

      // Create context for SecureDataAccess
      const context = this.createSecureContext(practiceContext, 'deleteAppointment');

      // Find the appointment first
      let appointment;
      if (appointmentId) {
        const appointments = await SecureDataAccess.query('appointments',
          { _id: typeof appointmentId === 'string' && appointmentId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(appointmentId) : appointmentId },
          { limit: 1 },
          context
        );
        appointment = appointments && appointments[0];
      } else {
        const appointments = await SecureDataAccess.query('appointments',
          { appointmentNumber },
          { limit: 1 },
          context
        );
        appointment = appointments && appointments[0];
      }

      if (!appointment) {
        console.log(`⚠️ Appointment not found: ID=${appointmentId}, Number=${appointmentNumber}`);
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'התור לא נמצא במערכת'
            : 'Appointment not found in system'
        };
      }

      // Store values for cleanup
      const providerId = appointment.providerId;
      const patientId = appointment.patientId;
      const date = appointment.scheduledDate;

      // STEP 1: Set status to 'deleted' for visibility during troubleshooting
      // Note: SecureDataAccess.update() automatically wraps in $set, so pass plain object
      await SecureDataAccess.update('appointments', { _id: appointment._id }, {
        status: 'deleted',
        deletionReason: reason || 'Deleted permanently',
        lastUpdated: new Date(),
        updatedBy: session?.userId || 'Agent'
      }, context);
      console.log(`📝 Appointment ${appointment._id} status changed to 'deleted'`);

      // STEP 2: PERMANENTLY DELETE the appointment document from database
      await SecureDataAccess.delete('appointments', { _id: appointment._id }, context);
      console.log(`✅ Appointment ${appointment._id} PERMANENTLY DELETED from database`);

      // Clean up all references in user and patient records
      await this.cleanupAppointmentReferences(appointment._id, context, providerId, patientId);

      // Invalidate cache for this provider/date
      if (providerId && date) {
        availabilityService.invalidateCache(
          providerId,
          date.toISOString().split('T')[0],
          practiceContext.practiceId
        );
      }

      return {
        success: true,
        message: practiceContext.language === 'he'
          ? 'התור נמחק לצמיתות'
          : 'Appointment permanently deleted',
        appointmentId: appointment._id,
        deleted: true
      };
    } catch (error) {
      console.error('Error deleting appointment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה במחיקת התור: ${error.message}`
          : `Error deleting appointment: ${error.message}`
      };
    }
  }

  /**
   * Reinstate appointment - Changes a cancelled appointment back to 'scheduled' status
   * Use this to restore a cancelled appointment
   * @param {Object} params - { appointmentId, appointmentNumber, reason }
   * @returns {Promise<Object>} Result with success status
   */
  async reinstateAppointment(params, practiceContext, session) {
    try {
      const { appointmentId, appointmentNumber, reason } = params;

      if (!appointmentId && !appointmentNumber) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה תור או מספר תור'
          : 'Appointment ID or number required');
      }

      console.log(`♻️ Attempting to reinstate appointment: ID=${appointmentId}, Number=${appointmentNumber}`);

      // Create context for SecureDataAccess
      const context = this.createSecureContext(practiceContext, 'reinstateAppointment');

      // Find the appointment
      let appointment;
      if (appointmentId) {
        const appointments = await SecureDataAccess.query('appointments',
          { _id: typeof appointmentId === 'string' && appointmentId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(appointmentId) : appointmentId },
          { limit: 1 },
          context
        );
        appointment = appointments && appointments[0];
      } else {
        const appointments = await SecureDataAccess.query('appointments',
          { appointmentNumber },
          { limit: 1 },
          context
        );
        appointment = appointments && appointments[0];
      }

      if (!appointment) {
        console.log(`⚠️ Appointment not found: ID=${appointmentId}, Number=${appointmentNumber}`);
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'התור לא נמצא במערכת'
            : 'Appointment not found in system'
        };
      }

      // Check if appointment is actually cancelled
      if (appointment.status !== 'cancelled') {
        console.log(`ℹ️ Appointment ${appointment._id} is not cancelled (status: ${appointment.status})`);
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? `התור לא מבוטל (סטטוס נוכחי: ${appointment.status})`
            : `Appointment is not cancelled (current status: ${appointment.status})`
        };
      }

      // Store values for cache invalidation
      const providerId = appointment.providerId;
      const patientId = appointment.patientId;
      const date = appointment.scheduledDate;
      const time = appointment.scheduledTime;

      // NOTE: We skip availability checking when reinstating
      // If someone is reinstating a cancelled appointment, they typically want it back
      // regardless of current availability status. They can manually reschedule if needed.
      console.log(`♻️ Reinstating appointment without availability check (user explicitly requested reinstatement)`);

      // Update status back to scheduled
      const updateData = {
        status: 'scheduled',
        reinstatedReason: reason || 'Reinstated by provider request',
        lastUpdated: new Date(),
        updatedBy: session?.userId || 'Agent'
      };

      // Note: SecureDataAccess.update() automatically wraps in $set, so pass plain object
      await SecureDataAccess.update('appointments', { _id: appointment._id }, updateData, context);
      console.log(`✅ Appointment ${appointment._id} reinstated to scheduled status`);

      // Invalidate cache for this provider/date
      if (providerId && date) {
        availabilityService.invalidateCache(
          providerId,
          date.toISOString().split('T')[0],
          practiceContext.practiceId
        );
      }

      return {
        success: true,
        message: practiceContext.language === 'he'
          ? 'התור הוחזר לסטטוס מתוזמן בהצלחה'
          : 'Appointment successfully reinstated to scheduled status',
        appointmentId: appointment._id,
        appointmentNumber: appointment.appointmentNumber,
        scheduledDate: date,
        scheduledTime: time
      };

    } catch (error) {
      console.error('Error reinstating appointment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהחזרת התור: ${error.message}`
          : `Error reinstating appointment: ${error.message}`
      };
    }
  }

  /**
   * Cancel appointment - Marks status as 'cancelled' but keeps the record for history
   * Use this when you want to preserve the appointment record for audit/history purposes
   * @param {Object} params - { appointmentId, appointmentNumber, reason }
   * @returns {Promise<Object>} Result with success status
   */
async cancelAppointment(params, practiceContext, session) {
    try {
      const { appointmentId, appointmentNumber, reason } = params;

      if (!appointmentId && !appointmentNumber) {
        throw new Error(practiceContext.language === 'he'
          ? 'נדרש מזהה תור או מספר תור'
          : 'Appointment ID or number required');
      }

      console.log(`🗑️ Attempting to cancel appointment: ID=${appointmentId}, Number=${appointmentNumber}`);

      // Direct database access if available
      if (practiceContext.models?.Appointment) {
        const { Appointment } = practiceContext.models;

        // Create context for SecureDataAccess
        const context = this.createSecureContext(practiceContext, 'cancelAppointment');

        // Find the appointment
        let appointment;
        if (appointmentId) {
          const appointments = await SecureDataAccess.query('appointments', { _id: typeof appointmentId === 'string' && appointmentId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(appointmentId) : appointmentId }, { limit: 1 }, context);
          appointment = appointments && appointments[0];
        } else {
          const appointments = await SecureDataAccess.query('appointments', { appointmentNumber }, { limit: 1 }, context);
          appointment = appointments && appointments[0];
        }

        if (!appointment) {
          console.log(`⚠️ Appointment not found in database: ID=${appointmentId}, Number=${appointmentNumber}`);

          // Still try to clean up user references even if appointment doesn't exist
          // This handles cases where appointment was deleted but references remain
          if (appointmentId) {
            await this.cleanupAppointmentReferences(appointmentId, context);
          }

          return {
            success: false,
            message: practiceContext.language === 'he'
              ? 'התור לא נמצא במערכת (ייתכן שכבר בוטל)'
              : 'Appointment not found in system (may have already been cancelled)',
            alreadyDeleted: true
          };
        }

        // Check if already cancelled
        if (appointment.status === 'cancelled') {
          console.log(`ℹ️ Appointment ${appointment._id} is already cancelled`);
          return {
            success: true,
            message: practiceContext.language === 'he'
              ? 'התור כבר בוטל'
              : 'Appointment is already cancelled',
            alreadyCancelled: true
          };
        }

        // Store values for cache invalidation and cleanup
        const providerId = appointment.providerId;
        const patientId = appointment.patientId;
        const date = appointment.scheduledDate;

        // Update status to cancelled
        const updateData = {
          status: 'cancelled',
          cancellationReason: reason || 'Cancelled by provider request',
          lastUpdated: new Date(),
          updatedBy: session?.userId || 'Agent'
        };

        // Note: SecureDataAccess.update() automatically wraps in $set, so pass plain object
        await SecureDataAccess.update('appointments', { _id: appointment._id }, updateData, context);
        console.log(`✅ Appointment ${appointment._id} marked as cancelled in database`);

        // Clean up references in user and patient records
        await this.cleanupAppointmentReferences(appointment._id, context, providerId, patientId);

        // Invalidate cache for this provider/date
        if (providerId && date) {
          availabilityService.invalidateCache(
            providerId,
            date.toISOString().split('T')[0],
            practiceContext.practiceId
          );
        }

        return {
          success: true,
          message: practiceContext.language === 'he'
            ? 'התור בוטל בהצלחה'
            : 'Appointment cancelled successfully',
          appointmentId: appointment._id
        };
      }
      
      // Fallback to SecureDataAccess if models not available
      const deleteFallbackContext = {
        serviceId: this.serviceName,
        operation: 'cancel_appointment_fallback',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Find appointment by ID or number
      const filter = appointmentId && appointmentId.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: new ObjectId(appointmentId) }
        : { appointmentNumber: appointmentNumber };

      // Note: SecureDataAccess.update() automatically wraps in $set, so pass plain object
      await SecureDataAccess.update(
        'appointments',
        filter,
        {
          status: 'cancelled',
          cancellationReason: reason || 'Cancelled by patient',
          updatedAt: new Date()
        },
        deleteFallbackContext
      );

      return {
        success: true,
        message: practiceContext.language === 'he'
          ? 'התור בוטל בהצלחה'
          : 'Appointment cancelled successfully'
      };
      
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בביטול התור: ${error.message}`
          : `Error cancelling appointment: ${error.message}`
      };
    }
  }

async updateAppointment(params, practiceContext, session) {
    try {
      const { appointmentId, appointmentNumber, providerName, doctor, ...updateData } = params;
      
      // Handle provider lookup if name/email is provided instead of ID
      if ((providerName || doctor) && !updateData.providerId) {
        const providerInfo = await this.lookupDoctor(providerName || doctor, practiceContext, session);
        updateData.providerId = providerInfo.providerId;
        updateData.providerName = providerInfo.providerName;
      }
      
      if (!appointmentId && !appointmentNumber) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה תור או מספר תור' 
          : 'Appointment ID or number required');
      }
      
      // Direct database access if available
      if (practiceContext.models?.Appointment) {
        const { Appointment } = practiceContext.models;

        // Create context for SecureDataAccess
        const context = this.createSecureContext(practiceContext, 'updateAppointment');

        // Find the appointment
        let appointment;
        if (appointmentId) {
          const appointments = await SecureDataAccess.query('appointments', { _id: typeof appointmentId === 'string' && appointmentId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(appointmentId) : appointmentId }, { limit: 1 }, context);
          appointment = appointments && appointments[0];
        } else {
          const appointments = await SecureDataAccess.query('appointments', { appointmentNumber }, { limit: 1 }, context);
          appointment = appointments && appointments[0];
        }
        
        if (!appointment) {
          return {
            success: false,
            message: practiceContext.language === 'he' 
              ? 'התור לא נמצא'
              : 'Appointment not found'
          };
        }
        
        // Store old values for cache invalidation
        const oldProviderId = appointment.providerId;
        const oldDate = appointment.scheduledDate;
        const oldTime = appointment.scheduledTime;
        
        // Check if time/date/provider is being changed
        const isRescheduling = updateData.scheduledDate || updateData.scheduledTime || updateData.providerId;
        
        if (isRescheduling) {
          // If rescheduling, need to check availability
          const newProviderId = updateData.providerId || appointment.providerId;
          const newDate = updateData.scheduledDate || appointment.scheduledDate;
          const newTime = updateData.scheduledTime || appointment.scheduledTime;
          const duration = updateData.duration || appointment.duration;
          
          // Reserve new slot
          const reservationResult = await availabilityService.reserveSlot(
            newProviderId,
            new Date(newDate).toISOString().split('T')[0],
            newTime,
            duration,
            practiceContext
          );
          
          if (!reservationResult.success) {
            return {
              success: false,
              message: practiceContext.language === 'he'
                ? `הזמן החדש לא זמין: ${reservationResult.message}`
                : `New time not available: ${reservationResult.message}`
            };
          }
        }
        
        // Update appointment fields
        if (updateData.scheduledDate) {
          if (typeof updateData.scheduledDate === 'string' && updateData.scheduledDate.includes('/')) {
            const [day, month, year] = updateData.scheduledDate.split('/');
            appointment.scheduledDate = new Date(year, month - 1, day);
          } else {
            appointment.scheduledDate = new Date(updateData.scheduledDate);
          }
        }
        
        if (updateData.scheduledTime) appointment.scheduledTime = updateData.scheduledTime;
        if (updateData.duration) appointment.duration = updateData.duration;
        if (updateData.status) appointment.status = updateData.status;
        if (updateData.notes) appointment.notes = updateData.notes;
        if (updateData.appointmentType) appointment.appointmentType = updateData.appointmentType;
        if (updateData.appointmentReason) appointment.appointmentReason = updateData.appointmentReason;
        if (updateData.providerId) appointment.providerId = updateData.providerId;
        if (updateData.providerName) appointment.providerName = updateData.providerName;
        
        appointment.lastUpdated = new Date();
        appointment.updatedBy = session?.userId || 'Agent';

        const updatedAppointment = await SecureDataAccess.update('appointments', { _id: appointment._id }, appointment, context);
        
        // Invalidate cache for both old and new slots
        if (isRescheduling) {
          // Invalidate old slot
          availabilityService.invalidateCache(
            oldProviderId,
            new Date(oldDate).toISOString().split('T')[0],
            practiceContext.practiceId
          );
          
          // Invalidate new slot if different
          if (appointment.providerId !== oldProviderId || 
              appointment.scheduledDate.toDateString() !== oldDate.toDateString()) {
            availabilityService.invalidateCache(
              appointment.providerId,
              appointment.scheduledDate.toISOString().split('T')[0],
              practiceContext.practiceId
            );
          }
        }
        
        return {
          success: true,
          data: updatedAppointment,
          message: practiceContext.language === 'he' 
            ? 'התור עודכן בהצלחה'
            : 'Appointment updated successfully'
        };
      }
      
      // Fallback to SecureDataAccess if models not available
      const updateFallbackContext = {
        serviceId: this.serviceName,
        operation: 'update_appointment_fallback',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Note: SecureDataAccess.update() automatically wraps in $set, so pass plain object
      const updatedAppointment = await SecureDataAccess.update(
        'appointments',
        { _id: new ObjectId(params.appointmentId) },
        { ...params, updatedAt: new Date() },
        updateFallbackContext
      );

      return {
        success: true,
        data: updatedAppointment,
        message: practiceContext.language === 'he'
          ? 'התור עודכן בהצלחה'
          : 'Appointment updated successfully'
      };
      
    } catch (error) {
      console.error('Error updating appointment:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בעדכון התור: ${error.message}`
          : `Error updating appointment: ${error.message}`
      };
    }
  }

async findAvailableSlots(params, practiceContext, session) {
    try {
      // Handle doctor parameter - could be name, email, or Provider ID
      if (params.doctor && !params.providerId) {
        // Check if it's already a Provider ID
        if (params.doctor.startsWith('PROV-')) {
          console.log(`✅ Using Provider ID directly: ${params.doctor}`);
          params.providerId = params.doctor;
        } else {
          console.log(`🔍 Searching for provider: ${params.doctor}`);
          
          try {
            // Use the lookupDoctor helper which handles both names and emails
            const providerInfo = await this.lookupDoctor(params.doctor, practiceContext, session);
            params.providerId = providerInfo.providerId;
            console.log(`✅ Found provider: ${providerInfo.providerName} (${params.providerId})`);
          } catch (error) {
            return {
              success: false,
              message: error.message
            };
          }
        }
      }
      
      // Check user permissions for viewing provider schedules
      if (practiceContext.currentUser && params.providerId) {
        const userRoles = practiceContext.currentUser.roles || [];
        const userPermissions = practiceContext.currentUser.permissions || [];
        const userId = practiceContext.currentUser.id;

        // Create context for SecureDataAccess
        const context = this.createSecureContext(practiceContext, 'findAvailableSlots');

        // Get the provider's user ID to check if it's the same user
        const User = practiceContext.models.User;
        const providers = await SecureDataAccess.query('users', {
          'providerInfo.providerId': params.providerId
        }, { limit: 1 }, context);
        const provider = providers && providers[0];
        
        // Check if user can view this provider's schedule
        const canViewSchedule =
          // User viewing their own schedule
          (provider && provider._id.toString() === userId) ||
          // Admin, secretary, or medical director can view all
          userRoles.some(role => ['admin', 'secretary', 'medical_director'].includes(role)) ||
          // Has explicit permission to manage users
          userPermissions.includes('manage_users');
        
        if (!canViewSchedule) {
          // For basic staff, only show limited availability without detailed slots
          console.log(`⚠️ User ${practiceContext.currentUser.email} has limited access to provider schedules`);
          
          // Return basic availability info only
          return {
            success: true,
            message: session.language === 'he' 
              ? 'אין לך הרשאה לראות את הלו"ז המלא. פנה למזכירות לקביעת תור.'
              : 'You don\'t have permission to view full schedules. Please contact reception to book an appointment.',
            limitedAccess: true,
            providerId: params.providerId
          };
        }
      }
      
      // Parse the date properly (handle both 'date' and 'dateRange' parameters)
      let checkDate;
      let dateParam = params.date || params.dateRange;
      
      // Handle date range format (e.g., "26/08/2025-26/08/2025")
      if (dateParam && dateParam.includes('-') && dateParam.includes('/')) {
        // Extract the first date from the range
        dateParam = dateParam.split('-')[0].trim();
        console.log(`📅 Extracted date from range: ${dateParam}`);
      }
      
      if (dateParam) {
        if (dateParam.includes('/')) {
          // Convert DD/MM/YYYY to Date object
          const [day, month, year] = dateParam.split('/');
          checkDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          console.log(`📅 Parsed DD/MM/YYYY date: ${day}/${month}/${year} -> ${checkDate.toISOString()}`);
        } else {
          checkDate = new Date(dateParam);
          console.log(`📅 Parsed ISO date: ${dateParam} -> ${checkDate.toISOString()}`);
        }
      } else {
        checkDate = new Date();
        console.log(`📅 Using today's date: ${checkDate.toISOString()}`);
      }
      
      // Validate the date
      if (isNaN(checkDate.getTime())) {
        console.error(`❌ Invalid date parsed from: ${dateParam}`);
        return {
          success: false,
          message: practiceContext.language === 'he' 
            ? `תאריך לא תקין: ${dateParam}. אנא השתמש בפורמט DD/MM/YYYY`
            : `Invalid date: ${dateParam}. Please use DD/MM/YYYY format`
        };
      }
      
      // Update params.date for the availability service - convert to YYYY-MM-DD format
      params.date = checkDate.toISOString().split('T')[0];
      
      // Use optimized availability service with caching
      try {
        const availabilityResult = await availabilityService.getAvailableSlots({
          providerId: params.providerId,
          date: params.date,
          duration: params.duration || 30
        }, practiceContext);
        
        if (availabilityResult.cached) {
          console.log('📊 Using cached availability data');
        }
        
        return availabilityResult;
      } catch (serviceError) {
        console.log('⚠️ Availability service error, falling back to direct query:', serviceError.message);
      }
      
      // Fallback: If service fails, use direct database access
      if (practiceContext.models?.Appointment) {
        const { Appointment } = practiceContext.models;
        
        // Get all appointments for this provider on this date
        const startOfDay = new Date(checkDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(checkDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingAppointments = await SecureDataAccess.query('appointments', {
          providerId: params.providerId,
          scheduledDate: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ['scheduled', 'confirmed'] }
        }, {}, context).select('scheduledTime duration');
        
        // Create a map of busy times
        const busyTimes = new Set();
        existingAppointments.forEach(apt => {
          const duration = apt.duration || 30;
          const [hour, minute] = apt.scheduledTime.split(':').map(Number);
          
          // Block the appointment time and duration
          for (let i = 0; i < duration; i += 15) {
            const blockedHour = hour + Math.floor((minute + i) / 60);
            const blockedMinute = (minute + i) % 60;
            const timeKey = `${String(blockedHour).padStart(2, '0')}:${String(blockedMinute).padStart(2, '0')}`;
            busyTimes.add(timeKey);
          }
        });
        
        // Generate available slots based on working hours
        const availableSlots = [];
        const dayOfWeek = checkDate.getDay();
        
        // Israel working hours (Sunday-Thursday 9-17, Friday 9-12, Saturday closed)
        let startHour = 9;
        let endHour = 17;
        
        if (dayOfWeek === 5) { // Friday
          endHour = 12;
        } else if (dayOfWeek === 6) { // Saturday
          return {
            success: true,
            data: [],
            count: 0,
            message: practiceContext.language === 'he' 
              ? 'אין זמנים פנויים בשבת'
              : 'No appointments available on Saturday'
          };
        }
        
        // Generate 30-minute slots
        const slotDuration = params.duration || 30;
        console.log(`🕐 Generating slots from ${startHour}:00 to ${endHour}:00 with ${slotDuration} minute intervals`);
        console.log(`📋 Busy times found: ${busyTimes.size} slots blocked`);
        
        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = 0; minute < 60; minute += slotDuration) {
            const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            
            // Optional: Skip lunch break (12:00-13:00) - currently disabled to allow appointments
            // Uncomment the following lines if you want to enforce a lunch break
            // if (hour === 12 && dayOfWeek !== 5) {
            //   continue;
            // }
            
            // Check if this time is busy
            let isAvailable = true;
            for (let i = 0; i < slotDuration; i += 15) {
              const checkHour = hour + Math.floor((minute + i) / 60);
              const checkMinute = (minute + i) % 60;
              const checkTime = `${String(checkHour).padStart(2, '0')}:${String(checkMinute).padStart(2, '0')}`;
              if (busyTimes.has(checkTime)) {
                isAvailable = false;
                break;
              }
            }
            
            if (isAvailable) {
              availableSlots.push({
                date: checkDate.toISOString().split('T')[0],
                time: timeStr,
                available: true,
                duration: slotDuration
              });
            }
          }
        }
        
        console.log(`✅ Generated ${availableSlots.length} available slots for ${checkDate.toISOString().split('T')[0]}`);
        if (availableSlots.length > 0) {
          console.log(`   First slot: ${availableSlots[0].time}, Last slot: ${availableSlots[availableSlots.length - 1].time}`);
        }
        
        return {
          success: true,
          data: availableSlots,
          count: availableSlots.length,
          message: availableSlots.length === 0 
            ? (practiceContext.language === 'he' ? 'אין זמנים פנויים ביום זה' : 'No available slots on this date')
            : null
        };
      }
      
      // Fallback to API call if database not available
      const apiParams = {
        providerId: params.providerId,
        date: params.date || params.dateRange,
        duration: params.duration,
        preferredTime: params.preferredTime
      };

      // INFRASTRUCTURE: Complex appointment slot calculation with provider schedules - Keep as callAPI
      const response = await this.callAPI('/appointments/available', 'GET', apiParams, practiceContext);
      
      return {
        success: true,
        data: response.data || [],
        count: response.data ? response.data.length : 0
      };
    } catch (error) {
      console.error('Error finding available slots:', error);
      
      // If database is not available, return fallback slots
      if (error.message?.includes('database') || error.message?.includes('מסד נתונים') || 
          error.response?.data?.message?.en?.includes('database')) {
        console.log('⚠️ Database unavailable, providing fallback slots');
        
        const requestedDate = params.date || new Date().toISOString().split('T')[0];
        const defaultSlots = [];
        
        // Generate slots from 9 AM to 5 PM (lunch hour now available)
        for (let hour = 9; hour <= 17; hour++) {
          // Lunch hour (12:00) is now available for appointments
          {
            for (let minute = 0; minute < 60; minute += 30) {
              const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
              defaultSlots.push({
                date: requestedDate,
                time: timeStr,
                available: true,
                duration: params.duration || 30
              });
            }
          }
        }
        
        return {
          success: true,
          data: defaultSlots,
          count: defaultSlots.length,
          message: practiceContext.language === 'he' 
            ? 'זמנים זמינים (בדיקת זמינות מלאה לא זמינה כרגע)'
            : 'Available times (full availability check temporarily unavailable)'
        };
      }
      
      const isHebrew = session?.language === 'he' || practiceContext?.language === 'he';
      let errorMessage;
      
      // Check for database connection issues
      if (error.message?.includes('database not available') || error.message?.includes('מסד נתונים')) {
        errorMessage = {
          he: 'בעיה זמנית בחיבור למסד הנתונים. אנא נסה שוב בעוד מספר רגעים',
          en: 'Temporary database connection issue. Please try again in a few moments'
        };
      }
      // Check for specific error types
      else if (error.message?.includes('conflict') || error.message?.includes('busy') || 
          error.message?.includes('occupied') || error.message?.includes('booked')) {
        errorMessage = {
          he: 'לרופא יש כבר פגישה בשעה זו. אנא בחר זמן אחר',
          en: 'Doctor already has an appointment at this time. Please choose another time'
        };
      } else if (error.message?.includes('not available') || error.message?.includes('unavailable')) {
        errorMessage = {
          he: 'הרופא לא זמין בזמן המבוקש. אנא בחר זמן אחר',
          en: 'Doctor is not available at the requested time. Please choose another time'
        };
      } else if (error.message?.includes('outside working hours')) {
        errorMessage = {
          he: 'השעה המבוקשת מחוץ לשעות הקבלה של הרופא',
          en: 'Requested time is outside doctor\'s working hours'
        };
      } else {
        // Professional error message with suggestions
        errorMessage = {
          he: '⚠️ לא הצלחנו לאתר זמנים פנויים עבור התאריך והשעה המבוקשים.\n\n' +
              '💡 הצעות:\n' +
              '• נסה לבדוק תאריך אחר\n' +
              '• בדוק זמינות בשעה מוקדמת או מאוחרת יותר\n' +
              '• ודא שהתאריך נכון (DD/MM/YYYY)\n\n' +
              'אני כאן כדי לעזור למצוא זמן מתאים לפגישה.',
          en: '⚠️ Unable to find available appointment slots for the requested date and time.\n\n' +
              '💡 Suggestions:\n' +
              '• Try checking a different date\n' +
              '• Check availability at an earlier or later time\n' +
              '• Verify the date format is correct\n\n' +
              'I\'m here to help you find a suitable appointment time.'
        };
      }
      
      return {
        success: false,
        message: errorMessage,
        error: error.message,
        suggestAlternative: true
      };
    }
  }

async getDoctorAppointments(params, practiceContext, session) {
    try {
      const isHebrew = session.language === 'he';

      // Handle email or name lookup - convert to providerId
      let providerId = params.providerId;
      if (providerId && (providerId.includes('@') || !providerId.startsWith('PROV-'))) {
        console.log(`🔍 Looking up provider from identifier: ${providerId}`);
        const providerInfo = await this.lookupDoctor(providerId, practiceContext, session);
        providerId = providerInfo.providerId;
        console.log(`✅ Resolved to providerId: ${providerId}`);
      }

      const queryParams = new URLSearchParams();
      if (params.date) queryParams.append('date', params.date);
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.status) queryParams.append('status', params.status);

      const url = `/providers/${providerId}/appointments${queryParams.toString() ? `?${queryParams}` : ''}`;
      const result = await this.callAPI(url, 'GET', {}, practiceContext);
      
      if (result.success && result.data) {
        let message = isHebrew 
          ? `נמצאו ${result.data.length} פגישות:\n`
          : `Found ${result.data.length} appointments:\n`;
        
        result.data.forEach(apt => {
          message += `\n• ${apt.scheduledDate} ${apt.scheduledTime} - ${apt.patientName} (${apt.appointmentType}) [${apt.status}]`;
        });
        
        return {
          success: true,
          message,
          data: result.data
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error getting provider appointments:', error);
      return {
        success: false,
        message: session.language === 'he' ? 'שגיאה בקבלת פגישות' : 'Error getting appointments',
        error: error.message
      };
    }
  }

async sendAppointmentConfirmationRequest(params, practiceContext, session) {
    try {
      const { appointmentDate, providerId, method = 'both' } = params;
      const isHebrew = session.language === 'he';

      // Get appointments for the specified date/provider
      let query = { practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId };

      if (appointmentDate) {
        const date = new Date(appointmentDate);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        query.scheduledDate = { $gte: date, $lt: nextDay };
      }

      if (providerId) {
        query.providerId = providerId;
      }

      // Get appointments that need confirmation
      query.status = { $in: ['scheduled', 'confirmed'] };
      query.$or = [
        { confirmationSent: { $ne: true } },
        { confirmationSent: null }
      ];

      const appointments = await SecureDataAccess.query(
        'appointments',
        query,
        { limit: 100 },
        {
          serviceId: this.serviceToken || 'agent-service',
          apiKey: this.serviceAuth?.apiKey || this.serviceToken,
          practiceId: practiceContext.practiceId
        }
      );

      if (appointments.length === 0) {
        return {
          success: true,
          message: isHebrew
            ? 'לא נמצאו תורים הדורשים אישור'
            : 'No appointments found requiring confirmation',
          sent: 0
        };
      }

      let sent = 0;
      const errors = [];

      for (const appointment of appointments) {
        try {
          // Get patient details
          const patientResults = await SecureDataAccess.query(
            'patients',
            { _id: appointment.patientId }, { limit: 1 },
            {
              serviceId: this.serviceToken || 'agent-service',
              apiKey: this.serviceAuth?.apiKey || this.serviceToken,
              practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId
            }
          );

          const patient = patientResults[0];

          if (!patient) continue;

          const confirmationMessage = isHebrew
            ? `תזכורת ואישור תור: יש לך תור ב-${appointment.scheduledDate?.toLocaleDateString('he-IL')} בשעה ${appointment.scheduledTime}. אנא השב "כן" לאישור או "לא" לביטול.`
            : `Appointment confirmation: You have an appointment on ${appointment.scheduledDate?.toLocaleDateString('en-US')} at ${appointment.scheduledTime}. Please reply "YES" to confirm or "NO" to cancel.`;

          // Send SMS if requested and patient has phone
          if ((method === 'sms' || method === 'both') && patient.phone) {
            await this.callAPI('/communication/sms', 'POST', {
              patientId: patient._id,
              message: confirmationMessage,
              type: 'appointment_confirmation'
            }, practiceContext);
            sent++;
          }

          // Send email if requested and patient has email
          if ((method === 'email' || method === 'both') && patient.email) {
            await this.callAPI('/communication/email', 'POST', {
              patientId: patient._id,
              subject: isHebrew ? 'אישור תור' : 'Appointment Confirmation',
              body: confirmationMessage
            }, practiceContext);
            sent++;
          }

          // Mark confirmation as sent
          await SecureDataAccess.update(
            'appointments',
            { _id: appointment._id },
            { confirmationSent: true, confirmationSentAt: new Date() },
            {
              serviceId: this.serviceToken || 'agent-service',
              apiKey: this.serviceAuth?.apiKey || this.serviceToken,
              practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId
            }
          );

        } catch (error) {
          errors.push({
            appointmentId: appointment._id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: isHebrew
          ? `נשלחו ${sent} בקשות אישור תורים`
          : `Sent ${sent} appointment confirmation requests`,
        sent,
        totalAppointments: appointments.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Error sending appointment confirmations:', error);
      return {
        success: false,
        message: session.language === 'he'
          ? 'שגיאה בשליחת אישורי תורים'
          : 'Error sending appointment confirmations',
        error: error.message
      };
    }
  }

  /**
   * Get cancelled appointments - Shows only cancelled appointments for history/audit
   * @param {Object} params - { patientId, providerId, dateFrom, dateTo, limit }
   * @returns {Promise<Object>} Result with cancelled appointments
   */
  async getCancelledAppointments(params, practiceContext, session) {
    try {
      let { patientId, providerId, dateFrom, dateTo, limit = 100 } = params;

      // CRITICAL FIX: If providerId looks like an email, convert it to actual providerId
      // Claude sometimes passes email as providerId parameter
      if (providerId && providerId.includes('@')) {
        console.log(`📋 ProviderId is an email (${providerId}), looking up actual providerId...`);

        // Create context for SecureDataAccess
        const lookupContext = this.createSecureContext(practiceContext, 'getCancelledAppointments-lookup');

        // Query user by email to get providerId
        const users = await SecureDataAccess.query(
          'users',
          { email: providerId },
          { limit: 1, projection: { email: 1, 'profile.firstName': 1, 'profile.lastName': 1, 'providerInfo.providerId': 1 } },
          lookupContext
        );

        if (users && users.length > 0) {
          const user = users[0];

          // Check if user has providerId in providerInfo
          if (user.providerInfo?.providerId) {
            providerId = user.providerInfo.providerId;
            console.log(`✅ Found providerId from DB: ${providerId}`);
          }
          // If no providerId, construct it from name (same pattern as appointments use)
          else if (user.profile?.firstName && user.profile?.lastName) {
            const firstName = user.profile.firstName.toLowerCase();
            const lastName = user.profile.lastName.toLowerCase();
            providerId = `PROV-${firstName}-${lastName}`;
            console.log(`✅ Constructed providerId from user name: ${providerId}`);
          } else {
            throw new Error(practiceContext.language === 'he'
              ? `משתמש ${providerId} לא מוגדר כספק שירות`
              : `User ${providerId} is not set up as a provider`);
          }
        } else {
          throw new Error(practiceContext.language === 'he'
            ? `משתמש עם אימייל ${providerId} לא נמצא`
            : `User with email ${providerId} not found`);
        }
      }
      // If no patientId or providerId at all, try to get from practiceContext
      else if (!patientId && !providerId) {
        // Check if we have user email in practiceContext
        const userEmail = practiceContext.user?.email;

        if (userEmail) {
          console.log(`📋 No providerId provided, looking up from context email: ${userEmail}`);

          // Create context for SecureDataAccess
          const lookupContext = this.createSecureContext(practiceContext, 'getCancelledAppointments-lookup');

          // Query user by email to get providerId
          const users = await SecureDataAccess.query(
            'users',
            { email: userEmail },
            { limit: 1, projection: { email: 1, 'profile.firstName': 1, 'profile.lastName': 1, 'providerInfo.providerId': 1 } },
            lookupContext
          );

          if (users && users.length > 0) {
            const user = users[0];

            // Check if user has providerId in providerInfo
            if (user.providerInfo?.providerId) {
              providerId = user.providerInfo.providerId;
              console.log(`✅ Found providerId from DB: ${providerId}`);
            }
            // If no providerId, construct it from name (same pattern as appointments use)
            else if (user.profile?.firstName && user.profile?.lastName) {
              const firstName = user.profile.firstName.toLowerCase();
              const lastName = user.profile.lastName.toLowerCase();
              providerId = `PROV-${firstName}-${lastName}`;
              console.log(`✅ Constructed providerId from user name: ${providerId}`);
            }
          }
        }

        // If still no providerId, return error
        if (!providerId && !patientId) {
          throw new Error(practiceContext.language === 'he'
            ? 'נדרש מזהה מטופל או מזהה רופא'
            : 'Patient ID or Provider ID required');
        }
      }

      console.log(`📋 Getting cancelled appointments: patientId=${patientId}, providerId=${providerId}`);

      // Create context for SecureDataAccess
      const context = this.createSecureContext(practiceContext, 'getCancelledAppointments');

      // Build query
      const query = { status: 'cancelled' };

      if (patientId) {
        query.patientId = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId;
      }

      if (providerId) {
        query.providerId = providerId;
      }

      // Add date range if provided
      if (dateFrom || dateTo) {
        query.scheduledDate = {};
        if (dateFrom) query.scheduledDate.$gte = new Date(dateFrom);
        if (dateTo) query.scheduledDate.$lte = new Date(dateTo);
      }

      // Query cancelled appointments
      const appointments = await SecureDataAccess.query(
        'appointments',
        query,
        { sort: { scheduledDate: -1 }, limit: parseInt(limit) },
        context
      );

      console.log(`✅ Found ${appointments.length} cancelled appointments`);

      return {
        success: true,
        data: appointments,
        count: appointments.length,
        message: practiceContext.language === 'he'
          ? `נמצאו ${appointments.length} תורים מבוטלים`
          : `Found ${appointments.length} cancelled appointments`
      };
    } catch (error) {
      console.error('Error getting cancelled appointments:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בקבלת תורים מבוטלים: ${error.message}`
          : `Error getting cancelled appointments: ${error.message}`
      };
    }
  }

  /**
   * Clean up stale appointment references from user and patient records
   * This handles cases where appointments were deleted but references remain
   *
   * @param {string|ObjectId} appointmentId - The appointment ID to remove
   * @param {Object} context - Security context for database operations
   * @param {string} providerId - Optional provider ID to clean specific provider
   * @param {string} patientId - Optional patient ID to clean specific patient
   */
  async cleanupAppointmentReferences(appointmentId, context, providerId = null, patientId = null) {
    try {
      console.log(`🧹 Cleaning up references for appointment: ${appointmentId}`);
      let cleanedCount = 0;

      // Ensure appointmentId is an ObjectId
      const apptObjectId = typeof appointmentId === 'string' && appointmentId.match(/^[0-9a-fA-F]{24}$/)
        ? new ObjectId(appointmentId)
        : appointmentId;

      // Clean up provider references
      if (providerId) {
        // Clean specific provider
        console.log(`🧹 Cleaning appointment references for provider: ${providerId}`);

        // Find provider user by providerId
        const providerQuery = providerId.startsWith('PROV-')
          ? { 'providerInfo.providerId': providerId }
          : { _id: typeof providerId === 'string' && providerId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(providerId) : providerId };

        const result = await SecureDataAccess.update(
          'users',
          providerQuery,
          {
            $pull: { 'appointments.asProvider': apptObjectId }
          },
          context
        );

        if (result && result.modifiedCount > 0) {
          console.log(`✅ Removed appointment reference from provider: ${providerId}`);
          cleanedCount++;
        }
      } else {
        // Clean all users who might have this appointment reference
        console.log(`🧹 Cleaning appointment references from all users`);

        const result = await SecureDataAccess.update(
          'users',
          { 'appointments.asProvider': apptObjectId },
          {
            $pull: { 'appointments.asProvider': apptObjectId }
          },
          { ...context, multi: true } // Update all matching documents
        );

        if (result && result.modifiedCount > 0) {
          console.log(`✅ Removed appointment reference from ${result.modifiedCount} provider(s)`);
          cleanedCount += result.modifiedCount;
        }
      }

      // Clean up patient references
      if (patientId) {
        // Clean specific patient
        console.log(`🧹 Cleaning appointment references for patient: ${patientId}`);

        const patientObjectId = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/)
          ? new ObjectId(patientId)
          : patientId;

        // Update patient record
        const patientResult = await SecureDataAccess.update(
          'patients',
          { _id: patientObjectId },
          {
            $pull: {
              appointments: { appointmentId: apptObjectId }
            }
          },
          context
        );

        if (patientResult && patientResult.modifiedCount > 0) {
          console.log(`✅ Removed appointment reference from patient: ${patientId}`);
          cleanedCount++;
        }

        // Also check if patient has a user record
        const userResult = await SecureDataAccess.update(
          'users',
          { patientId: patientObjectId },
          {
            $pull: { 'appointments.created': apptObjectId }
          },
          context
        );

        if (userResult && userResult.modifiedCount > 0) {
          console.log(`✅ Removed appointment reference from patient's user record`);
          cleanedCount++;
        }
      } else {
        // Clean all patients who might have this appointment reference
        console.log(`🧹 Cleaning appointment references from all patients`);

        // Update all patient records
        const patientResult = await SecureDataAccess.update(
          'patients',
          { 'appointments.appointmentId': apptObjectId },
          {
            $pull: {
              appointments: { appointmentId: apptObjectId }
            }
          },
          { ...context, multi: true }
        );

        if (patientResult && patientResult.modifiedCount > 0) {
          console.log(`✅ Removed appointment reference from ${patientResult.modifiedCount} patient(s)`);
          cleanedCount += patientResult.modifiedCount;
        }

        // Update all user records that have this appointment
        const userResult = await SecureDataAccess.update(
          'users',
          { 'appointments.created': apptObjectId },
          {
            $pull: { 'appointments.created': apptObjectId }
          },
          { ...context, multi: true }
        );

        if (userResult && userResult.modifiedCount > 0) {
          console.log(`✅ Removed appointment reference from ${userResult.modifiedCount} patient user record(s)`);
          cleanedCount += userResult.modifiedCount;
        }
      }

      console.log(`🧹 Cleanup complete. Cleaned ${cleanedCount} reference(s) for appointment ${appointmentId}`);
      return { success: true, cleanedCount };

    } catch (error) {
      console.error(`❌ Error cleaning up appointment references:`, error);
      // Don't throw - this is a cleanup operation that shouldn't fail the main operation
      return { success: false, error: error.message };
    }
  }

}

module.exports = new AppointmentService();
