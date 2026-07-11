/**
 * PatientService
 *
 * Domain: patient
 * Extracted from: agentServiceV4.js
 * Functions: 58
 *
 * Purpose: Handle all patient-related operations including CRUD, medical history, follow-ups, and analytics
 *
 * Architecture:
 * - Uses SecureDataAccess for all database operations (no HTTP calls)
 * - Practice-aware multi-tenant isolation
 * - Proper error handling and logging
 * - Service authentication via ServiceAccountManager
 */

const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const AgentServiceHelpers = require('./agentServiceHelpers');
const { ObjectId } = require('mongodb');
const { getTimestampForDocument } = require('../utils/timezoneHelper');

class PatientService {
  constructor() {
    this.serviceName = 'patientService';
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
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

async searchPatients(params, practiceContext, session, externalContext = null) {
    try {
      // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess
      // Use external context if provided (from agentServiceV4), otherwise create own
      const searchPatientsContext = externalContext || {
        serviceId: this.serviceName,
        operation: 'search_patients',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      if (process.env.QUIET_LOGS !== 'true') console.log('🔐 [DEBUG] searchPatients context:', {
        hasExternalContext: !!externalContext,
        hasApiKey: !!searchPatientsContext.apiKey,
        apiKeyType: typeof searchPatientsContext.apiKey,
        practiceId: searchPatientsContext.practiceId
      });

      // Try to parse the query - might contain name, ID, email, phone, or SSN
      let searchQuery = params.query || params.searchTerm || params.nationalId || params.email || '';

      // Check if firstName/lastName are provided directly (from getPatientDetails)
      if (!searchQuery && (params.firstName || params.lastName)) {
        if (params.firstName && params.lastName) {
          searchQuery = `${params.firstName} ${params.lastName}`;
        } else if (params.firstName) {
          searchQuery = params.firstName;
        } else if (params.lastName) {
          searchQuery = params.lastName;
        }
        console.log(`🎯 Using name parameters: firstName="${params.firstName}", lastName="${params.lastName}" → query="${searchQuery}"`);
      }

      console.log(`🔍 Searching for patients with query: "${searchQuery}"`);

      let patients = [];

      // Check if it's an email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(searchQuery.trim())) {
        console.log('📧 Detected email search');
        patients = await SecureDataAccess.query(
          'patients',
          { email: searchQuery.trim() },
          {},
          searchPatientsContext
        );

        if (patients && patients.length > 0) {
          return {
            success: true,
            data: patients,
            count: patients.length,
            message: practiceContext.language === 'he'
              ? `נמצאו ${patients.length} מטופלים עם כתובת האימייל ${searchQuery}`
              : `Found ${patients.length} patient(s) with email ${searchQuery}`,
            displayData: {
              patients: patients,
              searchQuery: searchQuery,
              displayType: 'patientList'
            },
            displayInCard: true
          };
        }
      }

      // Check if it's a US SSN (XXX-XX-XXXX format)
      const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
      if (ssnRegex.test(searchQuery.trim())) {
        console.log('🆔 Detected SSN search');
        const ssnQuery = {
          $or: [
            { ssn: searchQuery.trim() },
            { socialSecurityNumber: searchQuery.trim() },
            { identifier: searchQuery.trim() }
          ]
        };
        console.log('🔍 [DEBUG] SSN query:', JSON.stringify(ssnQuery));

        patients = await SecureDataAccess.query(
          'patients',
          ssnQuery,
          {},
          searchPatientsContext
        );

        console.log(`🔍 [DEBUG] SSN search returned ${patients ? patients.length : 0} patients`);
        if (patients && patients.length > 0) {
          console.log('🔍 [DEBUG] First patient SSN fields:', {
            ssn: patients[0].ssn,
            socialSecurityNumber: patients[0].socialSecurityNumber,
            identifier: patients[0].identifier
          });
        }

        if (patients && patients.length > 0) {
          return {
            success: true,
            data: patients,
            count: patients.length,
            message: practiceContext.language === 'he'
              ? `נמצאו ${patients.length} מטופלים`
              : `Found ${patients.length} patient(s) with SSN ${searchQuery}`,
            displayData: {
              patients: patients,
              searchQuery: searchQuery,
              displayType: 'patientList'
            },
            displayInCard: true
          };
        }
      }

      // Check if query contains an Israeli ID number (9 digits)
      const idMatch = searchQuery ? searchQuery.match(/\b\d{9}\b/) : null;
      if (idMatch) {
        console.log('🆔 Detected Israeli ID search');
        // Search by nationalId field
        patients = await SecureDataAccess.query(
          'patients',
          { nationalId: idMatch[0] },
          {},
          searchPatientsContext
        );

        if (patients && patients.length > 0) {
          return {
            success: true,
            data: patients,
            count: patients.length,
            message: practiceContext.language === 'he'
              ? `נמצאו ${patients.length} מטופלים`
              : `Found ${patients.length} patients`,
            displayData: {
              patients: patients,
              searchQuery: searchQuery,
              displayType: 'patientList'
            },
            displayInCard: true
          };
        }
      }

      // Try searching by name (handles names, partial matches, etc.)
      console.log('🔍 Performing general name search');

      // Handle full name searches (e.g., "Helen Cox" or "Wilson, David Michael")
      let searchFilter;
      if (searchQuery.includes(' ')) {
        let firstName, lastName;

        // Check if format is "LastName, FirstName MiddleName"
        if (searchQuery.includes(',')) {
          const [lastPart, ...firstParts] = searchQuery.split(',').map(s => s.trim());
          lastName = lastPart;
          // Take only first name, ignore middle name
          firstName = firstParts.join(' ').split(/\s+/)[0];
          console.log(`   → Detected "LastName, FirstName" format: firstName="${firstName}", lastName="${lastName}"`);
        } else {
          // Format is "FirstName LastName" or "FirstName MiddleName LastName"
          const nameParts = searchQuery.trim().split(/\s+/);
          firstName = nameParts[0];
          // Take LAST part as lastName (ignores middle names)
          // This handles "Amanda Rose White" → firstName="Amanda", lastName="White"
          lastName = nameParts[nameParts.length - 1];
          console.log(`   → Detected full name: firstName="${firstName}", lastName="${lastName}"`);
        }

        // Normalize special characters for regex: O'Brien → O[_'\-\s]?Brien (matches O_Brien, O'Brien, OBrien)
        const normalizeForRegex = (name) => name.replace(/['\-_\s]/g, "[_'\\-\\s]?");
        const firstNameRegex = normalizeForRegex(firstName);
        const lastNameRegex = normalizeForRegex(lastName);
        const searchQueryRegex = normalizeForRegex(searchQuery);

        searchFilter = {
          $or: [
            // Try exact full name match (for legacy 'name' field if it exists)
            { name: { $regex: searchQueryRegex, $options: 'i' } },
            // Try firstName AND lastName match (primary method)
            {
              $and: [
                { firstName: { $regex: firstNameRegex, $options: 'i' } },
                { lastName: { $regex: lastNameRegex, $options: 'i' } }
              ]
            },
            // Fallback: match either field individually
            { firstName: { $regex: searchQueryRegex, $options: 'i' } },
            { lastName: { $regex: searchQueryRegex, $options: 'i' } }
          ]
        };
      } else {
        // Single term - search all fields
        const normalizeForRegex = (name) => name.replace(/['\-_\s]/g, "[_'\\-\\s]?");
        const searchQueryRegex = normalizeForRegex(searchQuery);
        searchFilter = {
          $or: [
            { name: { $regex: searchQueryRegex, $options: 'i' } },
            { firstName: { $regex: searchQueryRegex, $options: 'i' } },
            { lastName: { $regex: searchQueryRegex, $options: 'i' } }
          ]
        };
      }

      patients = await SecureDataAccess.query(
        'patients',
        searchFilter,
        { sort: { createdAt: -1 } },
        searchPatientsContext
      );

      // CRITICAL FIX: Sort by relevance, not creation date
      // When searching "David Wilson", prioritize exact matches over partial matches
      if (patients.length > 1 && searchQuery.includes(' ')) {
        const queryWords = searchQuery.trim().toLowerCase().split(/\s+/);
        const searchFirstName = queryWords[0];
        // Take LAST word as lastName (ignores middle names)
        // This handles "Amanda Rose White" → firstName="amanda", lastName="white"
        const searchLastName = queryWords[queryWords.length - 1];

        patients.sort((a, b) => {
          const aFirstName = (a.firstName || '').toLowerCase();
          const aLastName = (a.lastName || '').toLowerCase();
          const bFirstName = (b.firstName || '').toLowerCase();
          const bLastName = (b.lastName || '').toLowerCase();

          // Exact match for both first and last name gets highest priority
          const aExactMatch = aFirstName === searchFirstName && aLastName === searchLastName;
          const bExactMatch = bFirstName === searchFirstName && bLastName === searchLastName;

          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;

          // Next priority: First name exact match
          const aFirstExact = aFirstName === searchFirstName;
          const bFirstExact = bFirstName === searchFirstName;

          if (aFirstExact && !bFirstExact) return -1;
          if (!aFirstExact && bFirstExact) return 1;

          // Next priority: Last name exact match
          const aLastExact = aLastName === searchLastName;
          const bLastExact = bLastName === searchLastName;

          if (aLastExact && !bLastExact) return -1;
          if (!aLastExact && bLastExact) return 1;

          // Fallback to creation date
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        console.log(`✅ Sorted ${patients.length} patients by relevance. Top match: ${patients[0].firstName} ${patients[0].lastName}`);
      }

      // FUZZY SEARCH FALLBACK: If no results, try common typo corrections
      // Skip fuzzy search for SSN/ID patterns (they're exact numbers, don't have typos)
      const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;
      const israeliIdPattern = /\b\d{9}\b/;
      const isIdentifierSearch = ssnPattern.test(searchQuery.trim()) || israeliIdPattern.test(searchQuery);

      if (patients.length === 0 && searchQuery && !isIdentifierSearch) {
        console.log('⚠️ No exact matches found, trying fuzzy search for typos...');

        // Check if query has multiple words (full name search)
        const queryWords = searchQuery.trim().split(/\s+/);

        if (queryWords.length >= 2) {
          // Full name search: Generate variations for firstName (first word) and lastName (last word)
          // This handles "Amanda Rose White" → firstName="Amanda", lastName="White" (ignores middle)
          const firstName = queryWords[0];
          const lastName = queryWords[queryWords.length - 1];
          console.log(`   → Generating fuzzy variations for: firstName="${firstName}", lastName="${lastName}"`);

          const firstNameVariations = this.generateTypoVariations(firstName);
          const lastNameVariations = this.generateTypoVariations(lastName);

          console.log(`   → First name variations (${firstNameVariations.length}):`, firstNameVariations.slice(0, 3));
          console.log(`   → Last name variations (${lastNameVariations.length}):`, lastNameVariations.slice(0, 3));

          // Smart strategy: Build a single query with $or for all combinations
          // This is much faster than 900 separate queries!
          const combinationFilters = [];

          // Limit combinations to avoid too large query (10 × 10 = 100 max combinations)
          const maxFirstNames = Math.min(firstNameVariations.length, 10);
          const maxLastNames = Math.min(lastNameVariations.length, 10);

          for (let i = 0; i < maxFirstNames; i++) {
            for (let j = 0; j < maxLastNames; j++) {
              const firstNameVariant = firstNameVariations[i];
              const lastNameVariant = lastNameVariations[j];

              combinationFilters.push({
                $and: [
                  { firstName: { $regex: firstNameVariant, $options: 'i' } },
                  { lastName: { $regex: lastNameVariant, $options: 'i' } }
                ]
              });

              combinationFilters.push({
                name: { $regex: `${firstNameVariant}.*${lastNameVariant}`, $options: 'i' }
              });
            }
          }

          // Single query with all combinations
          const fuzzyFilter = { $or: combinationFilters };

          const fuzzyResults = await SecureDataAccess.query(
            'patients',
            fuzzyFilter,
            { sort: { createdAt: -1 } },
            searchPatientsContext
          );

          if (fuzzyResults && fuzzyResults.length > 0) {
            console.log(`✅ Fuzzy search found ${fuzzyResults.length} patient(s) using ${combinationFilters.length} name variations`);
            patients = fuzzyResults;
          }
        } else {
          // Single name search: Original logic
          const variations = this.generateTypoVariations(searchQuery);
          console.log(`   → Generated ${variations.length} variations:`, variations.slice(0, 5));

          for (const variant of variations) {
            const fuzzyFilter = {
              $or: [
                { name: { $regex: variant, $options: 'i' } },
                { firstName: { $regex: variant, $options: 'i' } },
                { lastName: { $regex: variant, $options: 'i' } }
              ]
            };

            const fuzzyResults = await SecureDataAccess.query(
              'patients',
              fuzzyFilter,
              { sort: { createdAt: -1 } },
              searchPatientsContext
            );

            if (fuzzyResults && fuzzyResults.length > 0) {
              console.log(`✅ Fuzzy search found ${fuzzyResults.length} patient(s) with variation "${variant}"`);
              patients = fuzzyResults;
              break;
            }
          }
        }
      }

      return {
        success: true,
        data: patients,
        count: patients.length,
        message: practiceContext.language === 'he'
          ? `נמצאו ${patients.length} מטופלים`
          : `Found ${patients.length} patients`,
        displayData: {
          patients: patients,
          searchQuery: params.query,
          displayType: 'patientList'
        },
        displayInCard: true
      };
      
    } catch (error) {
      console.error('Error searching patients:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0,
        message: practiceContext.language === 'he' 
          ? `שגיאה בחיפוש מטופלים: ${error.message}`
          : `Error searching patients: ${error.message}`
      };
    }
  }

async searchPatientsByName(params, practiceContext, session, externalContext = null) {
    try {
      const { name } = params;

      if (process.env.QUIET_LOGS !== 'true') console.log(`🔍 Searching for patients by name: "${name}"`);
      if (process.env.QUIET_LOGS !== 'true') console.log('🔐 [DEBUG] searchPatientsByName received context:', {
        hasExternalContext: !!externalContext,
        contextKeys: externalContext ? Object.keys(externalContext) : []
      });

      // Use the existing searchPatients function with name as query
      // Pass through the external context if provided
      const result = await this.searchPatients({ query: name }, practiceContext, session, externalContext);

      if (result.success && result.data && result.data.length > 0) {
        // CRITICAL FIX: Format patient data for Claude with ONLY essential fields
        // Claude must use patientId (ObjectId), not name!
        const formattedPatients = result.data.map(patient => ({
          patientId: patient._id?.toString(), // PRIMARY: This is the ID to use
          name: patient.name || `${patient.firstName} ${patient.lastName}`.trim(),
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          phone: patient.phone,
          email: patient.email,
          // NO SSN, NO other identifiers that Claude might confuse with patientId
        }));

        // Check for exact name match
        const searchNameLower = name.toLowerCase().trim();
        const exactMatch = formattedPatients.find(patient => {
          const fullName = `${patient.name}`.toLowerCase().trim();
          return fullName === searchNameLower;
        });

        const finalResult = {
          ...result,
          data: formattedPatients, // Use formatted patients with correct patientId
          message: practiceContext.language === 'he'
            ? `נמצאו ${formattedPatients.length} מטופלים עם השם "${name}"`
            : `Found ${formattedPatients.length} patient(s) with name "${name}"`
        };

        // If there's an exact match, add continuation hint for getFullMedicalReport
        if (exactMatch) {
          // CRITICAL: patientId is already the correct ObjectId string
          const mongoPatientId = exactMatch.patientId;

          finalResult.continueWith = {
            hint: practiceContext.language === 'he'
              ? `נמצא מטופל: ${exactMatch.name}. השתמש ב-patientId="${mongoPatientId}" (לא בשם!) עבור פונקציות רפואיות`
              : `Patient found: ${exactMatch.name}. IMPORTANT: Use patientId="${mongoPatientId}" (NOT the name!) for all medical data functions. The patientId parameter must be this exact ID string.`,
            patientId: mongoPatientId,
            patientName: exactMatch.name,
            nextFunction: 'getFullMedicalReport'
          };

          // Also add it at the top level for clarity
          finalResult.foundPatientId = mongoPatientId;

          // Set patient context so Claude knows which patient to use
          if (session) {
            if (!session.currentContext) {
              session.currentContext = {};
            }
            // CRITICAL: Use MongoDB _id (ObjectId) for all medical queries
            session.currentContext.patientId = mongoPatientId;
            session.currentContext.patientName = exactMatch.name;
          }
        }

        // Session context is maintained by agentServiceV4 after function returns
        return finalResult;
      } else {
        return {
          success: true,
          data: [],
          count: 0,
          message: practiceContext.language === 'he'
            ? `לא נמצאו מטופלים עם השם "${name}"`
            : `No patients found with name "${name}"`,
          displayData: {
            patients: [],
            searchQuery: name,
            displayType: 'patientList'
          },
          displayInCard: true
        };
      }
    } catch (error) {
      console.error('Error searching patients by name:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בחיפוש מטופלים: ${error.message}`
          : `Error searching patients: ${error.message}`
      };
    }
  }

async findPatient(params, practiceContext, session) {
    try {
      const { searchQuery } = params;
      
      console.log(`🔎 Finding patient with query: "${searchQuery}"`);
      
      // Use the existing searchPatients function
      const result = await this.searchPatients({ query: searchQuery }, practiceContext, session);
      
      if (result.success && result.data && result.data.length > 0) {
        // If exactly one patient found, return with success message
        if (result.data.length === 1) {
          const patient = result.data[0];
          return {
            ...result,
            message: practiceContext.language === 'he' 
              ? `נמצא המטופל: ${patient.firstName} ${patient.lastName}`
              : `Found patient: ${patient.firstName} ${patient.lastName}`
          };
        } else {
          // Multiple patients found
          return {
            ...result,
            message: practiceContext.language === 'he' 
              ? `נמצאו ${result.data.length} מטופלים התואמים לחיפוש`
              : `Found ${result.data.length} patients matching the search`
          };
        }
      } else {
        return {
          success: true,
          data: [],
          count: 0,
          message: practiceContext.language === 'he' 
            ? `לא נמצא מטופל התואם ל: "${searchQuery}"`
            : `No patient found matching: "${searchQuery}"`,
          displayData: {
            patients: [],
            searchQuery: searchQuery,
            displayType: 'patientList'
          },
          displayInCard: true
        };
      }
    } catch (error) {
      console.error('Error finding patient:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בחיפוש מטופל: ${error.message}`
          : `Error finding patient: ${error.message}`
      };
    }
  }

async listAllPatients(params, practiceContext) {
    try {
      const startTime = Date.now();
      const limit = params.limit || 100;

      console.log(`📋 Listing all patients (limit: ${limit})`);

      // Use SecureDataAccess for all database operations
      const SecureDataAccess = require('./secureDataAccess');

      // Create secure context with API key
      const context = this.createSecureContext(practiceContext, 'listAllPatients');

      // Query through SecureDataAccess - Redis caching handled by claudeResponseCache
      // IMPORTANT: Only fetch essential fields to prevent token limit issues
      const patients = await SecureDataAccess.query(
        'patients',
        {}, // Empty filter to get all patients
        {
          limit: limit,
          sort: { createdAt: -1 },
          projection: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            phone: 1,
            email: 1,
            gender: 1,
            status: 1,
            doctorSummary: 1,
            insuranceProvider: 1,
            socialSecurityNumber: 1,
            nationalId: 1,
            dateOfBirth: 1
          }
        },
        context
      );

      const totalTime = Date.now() - startTime;
      console.log(`⏱️ Patient list retrieved in ${totalTime}ms`);

      // Note: Cache status is now handled by claudeResponseCache.js internally
      const fromCache = totalTime < 100; // Fast response likely from cache

      // Format dates in patient data for better display
      const formattedPatients = patients.map(patient => {
        if (patient.dateOfBirth) {
          // Format date to readable format (MM/DD/YYYY)
          const date = new Date(patient.dateOfBirth);
          patient.dateOfBirth = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        }
        return patient;
      });

      // Prepare data with additional fields for grid display
      const gridData = formattedPatients.map(patient => ({
        ...patient,
        patientName: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth || '--',
        gender: patient.gender || '--',
        phone: patient.phone || patient.mobilePhone || patient.homePhone || '--',
        email: patient.email || '--',
        status: patient.status || 'Unknown',
        doctorSummary: patient.doctorSummary || '--',
        nationalId: patient.nationalId || patient.socialSecurityNumber || 'Not provided',
        ssn: patient.socialSecurityNumber || patient.nationalId || 'Not provided',
        insurance: patient.insuranceProvider || patient.insurance || patient.healthFund || 'Not provided',
        age: patient.dateOfBirth ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A'
      }));

      // Simple message - no duplicate list (grid shows all data)
      const message = `Showing ${gridData.length} patients in grid view.`;

      // Return data formatted for artifact panel grid view
      return {
        success: true,
        data: gridData,
        count: gridData.length,
        message: message,  // Simple message without duplicate patient list
        fromCache: fromCache,
        responseTime: totalTime,
        // Open artifact panel with grid view
        displayType: 'openArtifactPanel',
        skipClaudeFormatting: true,  // CRITICAL: Skip Claude processing, return data directly
        directReturn: true,           // CRITICAL: Return result without Claude follow-up
        artifactPanel: {
          type: 'grid',
          title: 'Patient List',
          category: 'patients',
          patientId: null,  // Not specific to one patient
          data: gridData,
          columns: ['patientName', 'dateOfBirth', 'gender', 'phone', 'email', 'status', 'doctorSummary'],
          headers: ['Patient Name', 'Date of Birth', 'Gender', 'Phone', 'Email', 'Status', 'Doctor Summary']
        }
      };
    } catch (error) {
      console.error('Error listing patients:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהצגת רשימת מטופלים: ${error.message}`
          : `Error listing patients: ${error.message}`
      };
    }
  }

  /**
   * Count total patients in the practice (efficient count, no documents materialized)
   */
  async countPatients(params, practiceContext) {
    try {
      const SecureDataAccess = require('./secureDataAccess');
      const context = this.createSecureContext(practiceContext, 'countPatients');

      const count = await SecureDataAccess.query('patients', {}, { count: true }, context);

      return {
        success: true,
        count: count,
        data: { totalPatients: count },
        message: practiceContext.language === 'he'
          ? `יש ${count} מטופלים במערכת`
          : `There are ${count} patients in the system`
      };
    } catch (error) {
      console.error('Error counting patients:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בספירת מטופלים: ${error.message}`
          : `Error counting patients: ${error.message}`
      };
    }
  }

async getPatientDetails(params, practiceContext, session) {
    try {
      // Initialize service authentication if needed
      if (!this.serviceAuth) {
        await this.initialize();
      }

      console.log('🔍 getPatientDetails called with params:', JSON.stringify(params));
      console.log('📌 Raw params object:', params);
      console.log('📌 Session context:', session?.currentContext ? {
        patientId: session.currentContext.patientId,
        patientName: session.currentContext.patientName
      } : 'No context');

      // Extract parameters for search
      let { patientId, firstName, lastName, email, nationalId, socialSecurityNumber, ssn, ...queryOptions } = params;

      // Handle SSN variations
      if (ssn && !socialSecurityNumber) {
        socialSecurityNumber = ssn;
      }

      // If patientId looks like a name, parse it
      if (patientId && !patientId.match(/^[0-9a-fA-F]{24}$/) && !nationalId && !firstName && !lastName) {
        // Check if it's a full name (contains space)
        const nameParts = patientId.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          console.log(`🎯 Parsing name from patientId: "${patientId}" → firstName: "${nameParts[0]}", lastName: "${nameParts[nameParts.length - 1]}"`);
          firstName = nameParts[0];
          lastName = nameParts[nameParts.length - 1];
          patientId = null; // Clear patientId since we're using name search
        }
      }

      // FIRST: Search for the patient if we don't have a direct ID
      if (!patientId && !nationalId && !socialSecurityNumber) {
        console.log('🔎 Searching for patient details...');
        
        // Build search query from available params
        const searchParams = {};
        if (firstName) searchParams.firstName = firstName;
        if (lastName) searchParams.lastName = lastName;
        if (email) searchParams.email = email;
        
        if (Object.keys(searchParams).length === 0 && session?.currentContext?.patientId) {
          // ONLY use context if no patient was explicitly requested
          // If params is empty object {}, it might mean no name was extracted
          console.log('⚠️ No search parameters provided. Params:', params);
          console.log('⚠️ This might indicate parameter extraction failed');

          // Check if original params had any indication of a patient name
          const hasAnyParams = Object.keys(params).length > 0;
          if (!hasAnyParams) {
            // Only use context if truly no parameters at all
            patientId = session.currentContext.patientId;
            console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
          } else {
            console.log('❌ Parameters exist but no patient identifiers found');
            return {
              success: false,
              error: practiceContext.language === 'he'
                ? 'לא נמצאו פרטי מטופל. אנא ציין שם או מזהה'
                : 'No patient details found. Please specify name or ID'
            };
          }
        } else if (Object.keys(searchParams).length > 0) {
          // Search for the patient
          try {
            const searchResult = await this.searchPatients(searchParams, practiceContext, session);
            if (searchResult.data && searchResult.data.length > 0) {
              const patient = searchResult.data[0];
              patientId = patient._id || patient.patientId;
              console.log(`✅ Found patient: ${patient.firstName} ${patient.lastName} (${patientId})`);
            } else {
              return {
                success: false,
                error: practiceContext.language === 'he'
                  ? 'לא נמצא מטופל. אנא ודא את פרטי המטופל'
                  : 'Patient not found. Please verify patient details'
              };
            }
          } catch (searchError) {
            console.error('Error searching for patient:', searchError);
            throw new Error(practiceContext.language === 'he'
              ? 'שגיאה בחיפוש מטופל'
              : 'Error searching for patient');
          }
        }
      }
      
      // Use nationalId if provided (for Israeli/international users)
      if (nationalId) {
        patientId = nationalId;
        console.log(`🎯 Using National ID: ${nationalId}`);
      }

      // Use SSN if provided (for USA users)
      if (socialSecurityNumber) {
        patientId = socialSecurityNumber;
        console.log(`🎯 Using SSN: ${socialSecurityNumber}`);
      }
      
      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מטופל. אנא ספק פרטי מטופל' 
          : 'Patient ID required. Please provide patient details');
      }
      
      // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess - use service's own authentication
      const getPatientDetailsContext = this.createSecureContext(practiceContext, 'get_patient_details');

      // Try different search strategies based on ID type
      let patients;
      const { ObjectId } = require('mongodb');

      // Detect identifier type FIRST to route to correct field and avoid validation errors
      const ssnPattern = /^\d{3}-\d{2}-\d{4}$/;  // US SSN format (XXX-XX-XXXX)
      const israelIdPattern = /^\d{9}$/;  // Israeli national ID (9 digits)

      // Route 1: US SSN format - query socialSecurityNumber field directly
      if (ssnPattern.test(patientId)) {
        patients = await SecureDataAccess.query(
          'patients',
          { socialSecurityNumber: patientId },
          {},
          getPatientDetailsContext
        );
      }
      // Route 2: Israeli national ID format - query nationalId field directly
      else if (israelIdPattern.test(patientId)) {
        patients = await SecureDataAccess.query(
          'patients',
          { nationalId: patientId },
          {},
          getPatientDetailsContext
        );
      }
      // Route 3: MongoDB ObjectId format - query _id field
      else if (ObjectId.isValid(patientId)) {
        patients = await SecureDataAccess.query(
          'patients',
          { _id: new ObjectId(patientId) },
          {},
          getPatientDetailsContext
        );
      }
      // Route 4: Custom patientId format - query patientId field
      else {
        patients = await SecureDataAccess.query(
          'patients',
          { patientId: patientId },
          {},
          getPatientDetailsContext
        );
      }

      const patient = patients && patients.length > 0 ? patients[0] : null;

      // Check if patient was found
      if (!patient) {
        return {
          success: false,
          error: 'Patient not found',
          message: practiceContext.language === 'he'
            ? `לא נמצא מטופל עם מזהה ${patientId}`
            : `No patient found with ID ${patientId}`
        };
      }

      // Format patient name for message
      const patientName = patient.patientName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown Patient';

      const returnValue = {
        success: true,
        data: patient,
        message: practiceContext.language === 'he'
          ? `פרטים מלאים עבור ${patientName}`
          : `Showing full details for ${patientName}`,
        displayType: 'openArtifactPanel',
        skipClaudeFormatting: true,
        directReturn: true,
        artifactPanel: {
          type: 'document',
          title: `Patient Details: ${patientName}`,
          category: 'patient_details',
          patientId: patient._id?.toString() || patient.patientId,
          documentId: patient._id?.toString() || patient.patientId,
          data: patient
        }
      };

      console.log('🎯 [getPatientDetails] Returning with directReturn:', {
        hasDirectReturn: returnValue.directReturn,
        hasSkipClaude: returnValue.skipClaudeFormatting,
        displayType: returnValue.displayType,
        hasArtifactPanel: !!returnValue.artifactPanel,
        patientName
      });

      return returnValue;
    } catch (error) {
      console.error('Error getting patient details:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בטעינת פרטי המטופל: ${error.message}`
          : `Error loading patient details: ${error.message}`
      };
    }
  }

async updatePatient(params, practiceContext, session) {
    // Use context if patientId not provided
    let { patientId, nationalId, socialSecurityNumber, firstName, lastName, email, ...updateData } = params;

    // FIRST: Search for the patient if we don't have a direct ID
    if (!patientId && !nationalId && !socialSecurityNumber) {
      console.log('🔎 Searching for patient to update...');

      // Build search query from available params
      const searchParams = {};
      if (firstName) searchParams.firstName = firstName;
      if (lastName) searchParams.lastName = lastName;
      if (email) searchParams.email = email;
      if (Object.keys(searchParams).length === 0 && session?.currentContext?.patientId) {
        // Use context if available
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      } else {
        // Search for the patient
        try {
          const searchResult = await this.searchPatients(searchParams, practiceContext, session);
          if (searchResult.data && searchResult.data.length > 0) {
            const patient = searchResult.data[0];
            patientId = patient._id || patient.patientId;
            console.log(`✅ Found patient: ${patient.firstName} ${patient.lastName} (${patientId})`);
          } else {
            return {
              success: false,
              error: practiceContext.language === 'he'
                ? 'לא נמצא מטופל להעדכון. אנא ודא את פרטי המטופל'
                : 'Patient not found for update. Please verify patient details'
            };
          }
        } catch (searchError) {
          console.error('Error searching for patient:', searchError);
          throw new Error(practiceContext.language === 'he'
            ? 'שגיאה בחיפוש מטופל'
            : 'Error searching for patient');
        }
      }
    }

    // Priority: Use nationalId if provided (more user-friendly)
    if (nationalId) {
      patientId = nationalId;
      console.log(`🎯 Using National ID for update: ${nationalId}`);
    }

    // Alternative: Use socialSecurityNumber if provided
    if (!patientId && socialSecurityNumber) {
      patientId = socialSecurityNumber;
      console.log(`🎯 Using Social Security Number for update: ${socialSecurityNumber}`);
    }

    // Still no patientId? Error
    if (!patientId) {
      throw new Error(practiceContext.language === 'he'
        ? 'מזהה מטופל חסר. נא לספק פרטי מטופל'
        : 'Patient ID is required. Please provide patient details');
    }
    
    // Check if there's actual data to update
    if (Object.keys(updateData).length === 0) {
      console.log('⚠️ No update data provided, only patient ID. Nothing to update.');
      return {
        success: false,
        message: practiceContext.language === 'he' 
          ? 'לא סופקו נתונים לעדכון. נא לציין את השדות שברצונך לעדכן'
          : 'No data to update. Please specify which fields you want to update'
      };
    }
    
    // Update patient using SecureDataAccess
    const updatePatientContext = {
      serviceId: this.serviceName,
      operation: 'update_patient',
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceToken
    };

    // Support MongoDB ID, National ID, and Social Security Number
    // Convert ObjectId to string if needed
    const patientIdString = typeof patientId === 'string' ? patientId : patientId.toString();

    // Determine filter based on identifier type
    let filter;
    if (patientIdString.match(/^[0-9a-fA-F]{24}$/)) {
      // MongoDB ObjectId
      filter = { _id: new ObjectId(patientIdString) };
    } else if (socialSecurityNumber && patientIdString === socialSecurityNumber) {
      // Social Security Number
      filter = { socialSecurityNumber: patientIdString };
    } else {
      // National ID (default)
      filter = { nationalId: patientIdString };
    }

    const updatedPatient = await SecureDataAccess.update(
      'patients',
      filter,
      { $set: { ...updateData, updatedAt: new Date() } },
      updatePatientContext
    );

    // Format patient name for message
    const patientName = updatedPatient.patientName || `${updatedPatient.firstName || ''} ${updatedPatient.lastName || ''}`.trim() || 'Unknown Patient';

    return {
      success: true,
      data: updatedPatient,
      message: practiceContext.language === 'he'
        ? `פרטי המטופל עודכנו בהצלחה`
        : `Patient details updated successfully`,
      // CRITICAL: Return artifactPanel to refresh the patient details view
      displayType: 'openArtifactPanel',
      skipClaudeFormatting: false,  // Let Claude format the response
      directReturn: true,
      artifactPanel: {
        type: 'document',
        title: `Patient Details: ${patientName}`,
        category: 'patient_details',
        patientId: updatedPatient._id?.toString() || updatedPatient.patientId,
        documentId: updatedPatient._id?.toString() || updatedPatient.patientId,
        data: updatedPatient
      }
    };
  }

async addPatient(params, practiceContext, session) {
    console.log('🔍 addPatient called with params:', JSON.stringify(params, null, 2));
    console.log('🏥 Practice context:', {
      country: practiceContext.country,
      practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId,
      practiceSubdomain: practiceContext.subdomain || practiceContext.practiceSubdomain,
      language: practiceContext.language
    });
    
    // CRITICAL: Prevent empty parameter calls (race condition protection)
    if (!params || Object.keys(params).length === 0) {
      console.log('🔴 CRITICAL: addPatient called with empty params - rejecting!');
      return {
        success: false,
        error: 'EMPTY_PARAMS',
        message: 'Cannot add patient with empty parameters. This might be a duplicate call from parallel execution.'
      };
    }
    
    // Validate minimum required fields
    if (!params.firstName || !params.lastName) {
      console.log('❌ Missing required fields: firstName or lastName');
      return {
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: practiceContext.language === 'he' 
          ? 'שם פרטי ושם משפחה הם שדות חובה'
          : 'First name and last name are required fields'
      };
    }
    
    // FIRST: Check if patient already exists by searching
    console.log('🔎 Checking if patient already exists...');
    const searchQuery = params.email || 
                        params.nationalId || 
                        params.socialSecurityNumber || 
                        `${params.firstName} ${params.lastName}`;
    
    try {
      const existingPatients = await this.searchPatients({
        query: searchQuery,
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        nationalId: params.nationalId,
        socialSecurityNumber: params.socialSecurityNumber
      }, practiceContext, session);
      
      if (existingPatients.data && existingPatients.data.length > 0) {
        // Patient already exists
        const existingPatient = existingPatients.data[0];
        console.log('⚠️ Patient already exists:', existingPatient);
        
        return {
          success: false,
          error: practiceContext.language === 'he' 
            ? `המטופל ${params.firstName} ${params.lastName} כבר קיים במערכת. האם תרצה לעדכן את הפרטים?`
            : `Patient ${params.firstName} ${params.lastName} already exists in the system. Would you like to update their information?`,
          existingPatient: existingPatient,
          suggestUpdate: true
        };
      }
    } catch (searchError) {
      console.log('📝 No existing patient found, proceeding with addition');
    }
    
    // Check if we have a pending document with extracted data
    if (session?.pendingDocumentId && practiceContext.models?.Document) {
      console.log('📄 Checking for extracted data from pending document...');
      try {
        // Convert pendingDocumentId string to ObjectId
        const documentObjectId = new ObjectId(session.pendingDocumentId);
        const document = await practiceContext.models.SecureDataAccess.query('documents', { _id: documentObjectId }, { limit: 1 }, {
    ...context
  })[0];
        if (document?.metadata) {
          console.log('✅ Found extracted metadata from document');
          
          // Pre-fill from document metadata if not provided
          if (!params.healthFund && document.metadata.healthFund) {
            params.healthFund = document.metadata.healthFund;
            console.log(`🏥 Using health fund from document: ${params.healthFund}`);
          }
          
          // Could also extract other fields if available
          if (!params.firstName && document.metadata.patientFirstName) {
            params.firstName = document.metadata.patientFirstName;
          }
          if (!params.lastName && document.metadata.patientLastName) {
            params.lastName = document.metadata.patientLastName;
          }
        }
      } catch (error) {
        console.log('⚠️ Could not retrieve document metadata:', error.message);
      }
    }
    
    // Format date if needed
    if (params.dateOfBirth && !params.dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      params.dateOfBirth = this.formatDate(params.dateOfBirth, practiceContext.language || 'he');
    }
    
    // Add required fields based on country
    // Determine country context - check multiple sources
    let detectedCountry = practiceContext.country || params.country;
    
    // If we have SSN or US insurance, it's likely a US patient
    if (!detectedCountry && (params.socialSecurityNumber || params.insuranceProvider)) {
      console.log('🇺🇸 Detected US patient based on SSN or insurance provider');
      detectedCountry = 'USA';
    }
    
    // If we have Israeli health fund, it's likely an Israeli patient  
    if (!detectedCountry && params.healthFund) {
      console.log('🇮🇱 Detected Israeli patient based on health fund');
      detectedCountry = 'Israel';
    }
    
    // Default to USA if still not determined (most common case)
    if (!detectedCountry) {
      console.log('📍 No country detected, defaulting to USA');
      detectedCountry = 'USA';
    }
    
    const isIsrael = detectedCountry === 'Israel' || detectedCountry === 'IL';
    const isUSA = detectedCountry === 'United States' || detectedCountry === 'USA' || detectedCountry === 'US';
    
    console.log(`🌍 Country check - isIsrael: ${isIsrael}, isUSA: ${isUSA}, detectedCountry: ${detectedCountry}, patientCountry: ${params.country}`);
    
    if (isIsrael) {
      // Map nationalId if not provided but other ID fields are
      if (!params.nationalId) {
        if (params.ssn || params.socialSecurityNumber) {
          // User provided SSN but this is an Israeli practice - map to nationalId
          params.nationalId = params.ssn || params.socialSecurityNumber;
          delete params.ssn;
          delete params.socialSecurityNumber;
        }
      }
      
      // Ensure healthFund is provided for Israeli patients
      if (!params.healthFund) {
        // Check if it might be under a different name
        if (params.health_fund) {
          params.healthFund = params.health_fund;
          delete params.health_fund;
        } else if (params.קופת_חולים) {
          params.healthFund = params.קופת_חולים;
          delete params.קופת_חולים;
        } else if (params.kupat_holim) {
          params.healthFund = params.kupat_holim;
          delete params.kupat_holim;
        } else if (params.insuranceProvider) {
          // User provided insurance but this is Israel - map to health fund
          params.healthFund = params.insuranceProvider;
          delete params.insuranceProvider;
        } else {
          // Log warning and throw error
          console.log('❌ healthFund not provided, throwing error to ask user');
          throw new Error(practiceContext.language === 'he' 
            ? 'קופת חולים חסרה. אנא שאל את המשתמש באיזו קופת חולים המטופל חבר (כללית/מכבי/מאוחדת/לאומית)'
            : 'Health fund is required. Please ask which health fund (Clalit/Maccabi/Meuhedet/Leumit)');
        }
      }
      
      // Validate health fund value
      const validHealthFunds = ['כללית', 'מכבי', 'מאוחדת', 'לאומית'];
      if (!validHealthFunds.includes(params.healthFund)) {
        throw new Error(practiceContext.language === 'he' 
          ? `קופת חולים לא תקינה. אפשרויות: ${validHealthFunds.join(', ')}`
          : `Invalid health fund. Options: ${validHealthFunds.join(', ')}`);
      }
    } else if (isUSA) {
      // Map SSN field names for US patients - the API expects socialSecurityNumber
      if (!params.socialSecurityNumber) {
        if (params.ssn) {
          params.socialSecurityNumber = params.ssn;
          delete params.ssn;
        } else if (params.nationalId) {
          // User provided nationalId but this is a US practice - map to SSN
          params.socialSecurityNumber = params.nationalId;
          delete params.nationalId;
        }
      }
      
      // Map insurance provider field names
      if (!params.insuranceProvider) {
        if (params.insurance) {
          params.insuranceProvider = params.insurance;
          delete params.insurance;
        } else if (params.healthFund) {
          // User provided health fund but this is US - map to insurance
          params.insuranceProvider = params.healthFund;
          delete params.healthFund;
        }
      }
      
      // Insurance is required for US patients
      if (!params.insuranceProvider) {
        console.log('❌ insuranceProvider not provided for US patient');
        console.log('📋 ALL params received:', JSON.stringify(params, null, 2));
        console.log('🔍 Checking for insurance in other fields:');
        console.log('  - params.insurance:', params.insurance);
        console.log('  - params.healthFund:', params.healthFund);
        console.log('  - params.insuranceCompany:', params.insuranceCompany);
        console.log('  - params.carrier:', params.carrier);
        throw new Error('Insurance provider is required for US patients. Please provide the insurance provider (e.g., Medicare, Blue Cross, Aetna, UnitedHealth, Cigna, Kaiser, Humana, etc.)');
      }
      
      // Validate insurance provider for US patients - comprehensive list 2024-2025
      const commonUSInsurers = [
        // Government programs
        'medicare', 'medicaid', 'tricare', 'va', 'veterans affairs', 'chip',
        
        // Major national insurers (by market share)
        'unitedhealth', 'united healthcare', 'uhc', 'unitedhealthcare',
        'elevance', 'elevance health', 'anthem', // Anthem is now Elevance Health
        'aetna', 'cvs', 'cvs health', 'cvs aetna',
        'cigna', 'cigna healthcare',
        'humana',
        'kaiser', 'kaiser permanente', 'kaiser foundation',
        
        // Blue Cross Blue Shield and affiliates
        'blue cross', 'blue shield', 'bcbs', 'bluecross', 'blueshield',
        'hcsc', 'health care service corporation', // BCBS parent
        'carefirst', 'carefirst bluecross', // BCBS DC/MD/VA
        'highmark', // BCBS PA/WV/DE
        'regence', // BCBS Northwest
        'premera', 'premera blue cross', // BCBS Alaska/Washington
        'florida blue', 'bcbs florida',
        'independence blue', 'independence blue cross', // BCBS Philadelphia
        'horizon', 'horizon blue cross', // BCBS New Jersey
        'empire', 'empire blue cross', // BCBS New York
        
        // Centene brands
        'centene', 'ambetter', 'wellcare', 'healthnet', 'health net',
        'sunshine health', 'superior healthplan',
        
        // Regional and specialty insurers
        'molina', 'molina healthcare',
        'oscar', 'oscar health',
        'bright health', 'brighthealth',
        'clover', 'clover health',
        'friday', 'friday health plans',
        'devoted', 'devoted health',
        'alignment', 'alignment health',
        
        // Regional insurers
        'amerihealth', 'amerihealth caritas',
        'wellpoint',
        'healthfirst', 'health first',
        'emblemhealth', 'emblem health',
        'geisinger', 'geisinger health',
        'priority health',
        'medical mutual',
        'blue cross blue shield',
        'bcbs',
        
        // California specific
        'covered california', 'la care', 'l.a. care',
        'health net california',
        
        // Other notable insurers
        'avmed', 'avmed health',
        'baylor scott white', 'baylor scott & white',
        'dean health', 'dean healthcare',
        'harvard pilgrim',
        'tufts', 'tufts health',
        'point32health', // Merger of Harvard Pilgrim and Tufts
        'selecthealth', 'select health',
        'moda', 'moda health',
        'cambia', 'cambia health',
        
        // Marketplace/ACA focused
        'community health choice',
        'common ground healthcare',
        'neighborhood health',
        
        // Medicare Advantage focused
        'scan', 'scan health',
        'wellcare medicare',
        'humana medicare'
      ];
      
      // Normalize the insurance provider name for validation
      const normalizedProvider = params.insuranceProvider.toLowerCase().trim();
      const isValidInsurer = commonUSInsurers.some(insurer => 
        normalizedProvider.includes(insurer) || insurer.includes(normalizedProvider)
      );
      
      if (!isValidInsurer) {
        console.log(`⚠️ Unusual insurance provider: ${params.insuranceProvider} - allowing but logging`);
        // Don't block, just warn - they might have a less common insurer
      }
      
      // Validate SSN format if provided (XXX-XX-XXXX or XXXXXXXXX)
      if (params.socialSecurityNumber) {
        const ssnRegex = /^(?:\d{3}-\d{2}-\d{4}|\d{9})$/;
        if (!ssnRegex.test(params.socialSecurityNumber.replace(/\s/g, ''))) {
          console.log(`⚠️ SSN format validation failed for: ${params.socialSecurityNumber}`);
          // Format it properly if possible
          const digitsOnly = params.socialSecurityNumber.replace(/\D/g, '');
          if (digitsOnly.length === 9) {
            params.socialSecurityNumber = `${digitsOnly.substr(0,3)}-${digitsOnly.substr(3,2)}-${digitsOnly.substr(5,4)}`;
            console.log(`✅ Formatted SSN to: ${params.socialSecurityNumber}`);
          } else {
            throw new Error('Invalid SSN format. Please provide a valid 9-digit Social Security Number (XXX-XX-XXXX)');
          }
        }
      }
      
      // Add state field for US patients if not provided
      if (!params.state && params.city) {
        console.log(`🗺️ Auto-detecting state for city: ${params.city}`);
        try {
          // Geocoding service disabled - not using Google API anymore
          // const locationDetails = await geocodingService.getLocationDetails(params.city);
          //
          // if (locationDetails.success && locationDetails.stateCode) {
          //   params.state = locationDetails.stateCode;
          //   console.log(`✅ Auto-detected state as ${locationDetails.stateCode} for ${params.city} (${locationDetails.state})`);

          //   // Also enhance the city name if we got a better formatted one
          //   if (locationDetails.city && locationDetails.city !== params.city) {
          //     console.log(`📍 Enhanced city name: ${params.city} → ${locationDetails.city}`);
          //     params.city = locationDetails.city;
          //   }
          // } else {
          // Geocoding disabled, use common city-state mappings as fallback
            const commonCityStates = {
              'san jose': 'CA',
              'san francisco': 'CA',
              'los angeles': 'CA',
              'san diego': 'CA',
              'sacramento': 'CA',
              'new york': 'NY',
              'manhattan': 'NY',
              'brooklyn': 'NY',
              'chicago': 'IL',
              'houston': 'TX',
              'dallas': 'TX',
              'austin': 'TX',
              'phoenix': 'AZ',
              'philadelphia': 'PA',
              'miami': 'FL',
              'orlando': 'FL',
              'tampa': 'FL',
              'atlanta': 'GA',
              'boston': 'MA',
              'seattle': 'WA',
              'denver': 'CO',
              'las vegas': 'NV',
              'portland': 'OR',
              'detroit': 'MI',
              'minneapolis': 'MN',
              'new haven': 'CT',
              'hartford': 'CT',
              'stamford': 'CT'
            };
            
            const cityLower = params.city.toLowerCase().trim();
            if (commonCityStates[cityLower]) {
              params.state = commonCityStates[cityLower];
              console.log(`✅ Detected state ${params.state} for ${params.city} from common mappings`);
            } else {
              // Last resort - ask for state
              throw new Error(`Could not auto-detect state for ${params.city}. Please provide the 2-letter state code (e.g., CA for California, NY for New York)`);
            }
          // } // Closing brace for geocoding if-else block (commented out)
        } catch (geoError) {
          console.log(`⚠️ Geocoding failed: ${geoError.message}`);
          // If geocoding service fails, ask user for state
          throw new Error(`State is required for US patients. Please provide the 2-letter state code for ${params.city}`);
        }
      }
    } else {
      // For other countries, make fields optional
      console.log('⚠️ Non-Israel/USA country detected, making ID and insurance fields optional');
      console.log('📍 Treating as generic/international patient record');
      
      // Don't require insurance provider for non-US/Israel countries
      if (!params.insuranceProvider) {
        console.log('ℹ️ No insurance provider provided for international patient - this is OK');
        // Remove any insurance-related fields to prevent validation issues
        delete params.insuranceProvider;
        delete params.insurance;
      }
      
      // Don't require specific ID formats for international patients
      if (!params.nationalId && !params.socialSecurityNumber) {
        console.log('ℹ️ No ID provided for international patient - using name as identifier');
      }
    }
    
    console.log('📤 Creating patient with params:', JSON.stringify(params, null, 2));

    const createPatientContext = {
      serviceId: this.serviceName,
      operation: 'create_patient',
      practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
      apiKey: this.serviceAuth?.apiKey || this.serviceToken
    };

    const newPatient = await SecureDataAccess.insert(
      'patients',
      {
        ...params,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      createPatientContext
    );

    const response = { success: true, data: newPatient };
    
    // Check if the response is an error (duplicate ID or other)
    if (response.success === false) {
      const isHebrew = practiceContext.language === 'he';
      
      // Handle specific error messages
      // Check if error is a string or an object with language keys
      let errorMessage = '';
      if (typeof response.error === 'string') {
        errorMessage = response.error;
      } else if (response.error && typeof response.error === 'object') {
        errorMessage = response.error[isHebrew ? 'he' : 'en'] || response.error.en || JSON.stringify(response.error);
      }
      
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        return {
          success: false,
          error: isHebrew 
            ? `מטופל עם תעודת זהות ${params.nationalId || params.ssn} כבר קיים במערכת. האם תרצה לעדכן את הפרטים שלו?`
            : `A patient with ID ${params.nationalId || params.ssn} already exists in the system. Would you like to update their information?`,
          existingPatientId: params.nationalId || params.ssn,
          suggestUpdate: true
        };
      }
      
      // Return the error message from backend
      return {
        success: false,
        error: errorMessage || response.message || 'Failed to add patient',
        details: response.details,
        code: response.code
      };
    }
    
    // Add user-friendly patient identifier
    const patientData = response.data;
    if (patientData) {
      // For US patients, use SSN as the patient identifier
      if (isUSA && patientData.ssn) {
        patientData.patientIdentifier = patientData.ssn;
        patientData.identifierType = 'SSN';
      } 
      // For Israeli patients, use National ID
      else if (isIsrael && patientData.nationalId) {
        patientData.patientIdentifier = patientData.nationalId;
        patientData.identifierType = 'National ID';
      }
      // Add a note to not display MongoDB ID to users
      patientData._displayNote = 'Use patientIdentifier for user display, not _id';
    }
    
    return {
      success: true,
      data: patientData,
      message: practiceContext.language === 'he' 
        ? `המטופל ${params.firstName} ${params.lastName} נוסף בהצלחה!`
        : `Patient ${params.firstName} ${params.lastName} added successfully!`
    };
  }

async deletePatientBySearch(params, practiceContext, session) {
    console.log('🗑️ DELETE PATIENT REQUEST');
    
    try {
      const { searchQuery } = params;
      const reason = params.reason || (practiceContext.language === 'he' ? 'בקשת משתמש' : 'User request');
      
      // Step 1: Search for the patient
      console.log(`🔍 Searching for patient: ${searchQuery}`);
      const searchResult = await this.searchPatients({ query: searchQuery }, practiceContext, session);
      
      if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? `לא נמצא מטופל התואם ל: ${searchQuery}`
            : `No patient found matching: ${searchQuery}`
        };
      }
      
      if (searchResult.data.length > 1) {
        const names = searchResult.data.map(p => `${p.firstName} ${p.lastName}`).join(', ');
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? `נמצאו מספר מטופלים: ${names}. אנא היה יותר ספציפי`
            : `Multiple patients found: ${names}. Please be more specific`
        };
      }
      
      // Step 2: Delete the patient
      const patient = searchResult.data[0];
      const patientId = patient._id || patient.patientId;
      const patientName = `${patient.firstName} ${patient.lastName}`;
      
      console.log(`🗑️ Deleting patient ${patientName} (${patientId}) - Reason: ${reason}`);
      
      // Call the internal delete function
      return await this.deletePatientInternal(patientId, patientName, reason, practiceContext);
      
    } catch (error) {
      console.error('Delete patient error:', error);
      return {
        success: false,
        message: error.message || (practiceContext.language === 'he' ? 'שגיאה במחיקת מטופל' : 'Error deleting patient')
      };
    }
  }

async importPatientsFromCSV(params, practiceContext, session) {
    try {
      const { uploadId, fileIndex = 0, mappings } = params;

      if (!uploadId) {
        const error = practiceContext.language === 'he'
          ? 'מזהה העלאה נדרש'
          : 'Upload ID is required';
        console.error('Import failed - no upload ID', { error });
        throw new Error(error);
      }

      console.log(`📊 Importing patients from CSV: ${uploadId}, file index: ${fileIndex}`);

      // Import CSV cache helper for optimized Claude API calls
      const csvCacheHelper = require('./csvImportCacheHelper');
      
      // CRITICAL: Only use practice-specific database, NEVER global (security requirement)
      if (!practiceContext.practiceSubdomain && !practiceContext.practiceId) {
        return {
          success: false,
          error: 'NO_CLINIC_CONTEXT',
          message: practiceContext.language === 'he' 
            ? 'לא ניתן לייבא מטופלים ללא הקשר מרפאה'
            : 'Cannot import patients without practice context'
        };
      }
      
      // Determine country context for validation
      const detectedCountry = practiceContext.country || 'USA';
      const isIsrael = detectedCountry === 'Israel' || detectedCountry === 'IL';
      const isUSA = detectedCountry === 'United States' || detectedCountry === 'USA' || detectedCountry === 'US';
      
      console.log(`🌍 CSV Import - Country: ${detectedCountry}, isUSA: ${isUSA}, isIsrael: ${isIsrael}`);
      
      // Use subdomain for proper database routing
      const clinicIdentifier = practiceContext.practiceSubdomain || practiceContext.practiceId;
      const context = {
        serviceId: this.serviceName,
        operation: 'importPatientsFromCSV',
        practiceId: clinicIdentifier,  // Use subdomain for database routing
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };
      
      const pendingUploads = await SecureDataAccess.query(
        'pendinguploads', 
        { uploadId }, 
        { limit: 1 }, 
        context
      );
      
      if (!pendingUploads || pendingUploads.length === 0) {
        return {
          success: false,
          error: 'UPLOAD_NOT_FOUND',
          message: practiceContext.language === 'he' 
            ? `לא נמצאה העלאה עם מזהה ${uploadId}`
            : `No upload found with ID ${uploadId}`
        };
      }
      
      const pendingUpload = pendingUploads[0];
      const file = pendingUpload.files[fileIndex];
      
      if (!file) {
        return {
          success: false,
          error: 'FILE_NOT_FOUND',
          message: practiceContext.language === 'he' 
            ? `לא נמצא קובץ באינדקס ${fileIndex}`
            : `No file found at index ${fileIndex}`
        };
      }
      
      // Check if it's a CSV file
      if (!file.mimetype.includes('csv') && !file.originalName.toLowerCase().endsWith('.csv')) {
        return {
          success: false,
          error: 'NOT_CSV',
          message: practiceContext.language === 'he' 
            ? 'הקובץ אינו קובץ CSV'
            : 'File is not a CSV file'
        };
      }
      
      // Decrypt the file using E2E encryption service
      const e2eEncryptionService = require('./e2eEncryptionService');
      
      // Prepare encrypted package for E2E service
      let encryptedData;
      
      if (file.encryptedPackage) {
        // Already has the package structure
        encryptedData = file.encryptedPackage;
      } else {
        // Convert to package structure
        let dataBuffer;
        
        if (Buffer.isBuffer(file.encryptedContent)) {
          dataBuffer = file.encryptedContent;
        } else if (file.encryptedContent && file.encryptedContent.type === 'Buffer' && Array.isArray(file.encryptedContent.data)) {
          // MongoDB Buffer representation
          dataBuffer = Buffer.from(file.encryptedContent.data);
        } else if (typeof file.encryptedContent === 'string') {
          // Base64 string
          dataBuffer = Buffer.from(file.encryptedContent, 'base64');
        } else {
          throw new Error(`Invalid encryptedContent type: ${typeof file.encryptedContent}`);
        }
        
        encryptedData = {
          data: dataBuffer.toString('base64'),
          iv: file.contentIv,
          tag: file.contentTag,
          algorithm: 'aes-256-gcm'
        };
      }
      
      console.log('🔐 Decrypting CSV with E2E encryption service (service key)');

      // Decrypt using service key (files are encrypted with encryptWithServiceKey, not user keys)
      const decryptedResult = await e2eEncryptionService.decryptWithServiceKey(
        encryptedData
      );
      
      const decryptedContent = Buffer.isBuffer(decryptedResult.data) 
        ? decryptedResult.data 
        : Buffer.from(decryptedResult.data, 'base64');
        
      const csvContent = decryptedContent.toString('utf-8');
      
      // Parse CSV
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        return {
          success: false,
          error: 'EMPTY_CSV',
          message: practiceContext.language === 'he' 
            ? 'קובץ CSV ריק או לא תקין'
            : 'CSV file is empty or invalid'
        };
      }
      
      // Parse headers
      const headers = lines[0].split(',').map(h => h.trim());
      
      // Known insurance providers for normalization
      const knownInsuranceProviders = {
        // US Insurance Providers
        'blue cross': 'Blue Cross',  // Keep as is if only Blue Cross
        'blue shield': 'Blue Shield of California',  // Keep as is if only Blue Shield
        'bcbs': 'Blue Cross Blue Shield',
        'blue cross blue shield': 'Blue Cross Blue Shield',
        'aetna': 'Aetna',
        'kaiser': 'Kaiser Permanente',
        'kaiser permanente': 'Kaiser Permanente',
        'cigna': 'Cigna',
        'anthem': 'Anthem',
        'unitedhealth': 'UnitedHealth',  // Match your CSV exactly
        'united health': 'UnitedHealth',
        'unitedhealthcare': 'UnitedHealthcare',
        'humana': 'Humana',
        'medicare': 'Medicare',
        'medicaid': 'Medicaid',
        'centene': 'Centene',
        'molina': 'Molina Healthcare',
        'wellcare': 'WellCare',
        'caresource': 'CareSource',
        'wellpoint': 'WellPoint',
        'health net': 'Health Net',
        'coventry': 'Coventry Health Care',
        'amerigroup': 'Amerigroup',
        
        // Israeli Health Insurance (Kupot Holim)
        'clalit': 'Clalit Health Services',
        'כללית': 'Clalit Health Services',
        'maccabi': 'Maccabi Healthcare Services',
        'מכבי': 'Maccabi Healthcare Services',
        'meuhedet': 'Meuhedet',
        'מאוחדת': 'Meuhedet',
        'leumit': 'Leumit Health Care',
        'לאומית': 'Leumit Health Care'
      };
      
      // Function to normalize insurance provider name
      const normalizeInsuranceProvider = (provider) => {
        if (!provider) return '';
        const normalized = provider.toLowerCase().trim();
        return knownInsuranceProviders[normalized] || provider;
      };
      
      // Parse mappings if it's a string
      let parsedMappings = mappings;
      if (typeof mappings === 'string') {
        try {
          parsedMappings = JSON.parse(mappings);
          console.log('📊 Parsed mappings from string:', parsedMappings);
        } catch (error) {
          console.error('Failed to parse mappings:', error);
          return {
            success: false,
            error: 'INVALID_MAPPINGS',
            message: 'Invalid mappings format. Please provide a valid JSON object.'
          };
        }
      }
      
      // Auto-detect mappings based on Patient model fields if not provided
      if (!parsedMappings) {
        console.log('📊 No mappings provided - auto-detecting based on Patient model...');

        // Get all valid Patient model fields based on country
        const baseFields = [
          'firstName', 'lastName', 'dateOfBirth', 'email', 'phone',
          'street', 'city', 'zipCode', 'gender', 'bloodType',
          'emergencyContact', 'emergencyContactPhone', 'preferredLanguage',
          'status', 'doctorSummary', 'allergies'
        ];

        // Add country-specific fields
        const countrySpecificFields = [];
        if (isUSA) {
          countrySpecificFields.push('socialSecurityNumber', 'state', 'insuranceProvider', 'insuranceNumber');
        } else if (isIsrael) {
          countrySpecificFields.push('nationalId', 'healthFund');
        }

        const allValidFields = [...baseFields, ...countrySpecificFields];

        // Auto-generate mappings by matching CSV headers with Patient model fields
        const autoMappings = {};

        headers.forEach(header => {
          const normalizedHeader = header.trim().toLowerCase().replace(/[\s_-]/g, '');

          // Try exact match first
          const exactMatch = allValidFields.find(field =>
            field.toLowerCase() === normalizedHeader
          );

          if (exactMatch) {
            autoMappings[exactMatch] = header;
            console.log(`✅ Mapped: ${exactMatch} -> ${header}`);
          } else {
            // Try common variations
            const variations = {
              'ssn': 'socialSecurityNumber',
              'dob': 'dateOfBirth',
              'birthdate': 'dateOfBirth',
              'firstname': 'firstName',
              'lastname': 'lastName',
              'phonenumber': 'phone',
              'emailaddress': 'email',
              'address': 'street',
              'streetaddress': 'street',
              'zip': 'zipCode',
              'postalcode': 'zipCode',
              'insurance': 'insuranceProvider',
              'insuranceprovider': 'insuranceProvider',
              'insurancenumber': 'insuranceNumber',
              'policyno': 'insuranceNumber',
              'policynumber': 'insuranceNumber',
              'emergencycontactname': 'emergencyContact',
              'emergencycontactphone': 'emergencyContactPhone',
              'preferredlanguage': 'preferredLanguage',
              'language': 'preferredLanguage',
              'sex': 'gender',
              'bloodgroup': 'bloodType',
              'summary': 'doctorSummary',
              'doctornotes': 'doctorSummary'
            };

            const mappedField = variations[normalizedHeader];
            if (mappedField && allValidFields.includes(mappedField)) {
              autoMappings[mappedField] = header;
              console.log(`✅ Mapped (variation): ${mappedField} -> ${header}`);
            }
          }
        });

        // Log unmapped headers for debugging
        const mappedHeaders = Object.values(autoMappings);
        const unmappedHeaders = headers.filter(h => !mappedHeaders.includes(h));
        if (unmappedHeaders.length > 0) {
          console.log('⚠️ Unmapped CSV headers:', unmappedHeaders);
        }

        // Check if we have minimum required fields
        const requiredFields = ['firstName', 'lastName'];
        const missingRequired = requiredFields.filter(field => !autoMappings[field]);

        if (missingRequired.length > 0) {
          console.error('❌ Missing required fields:', missingRequired);
          return {
            success: false,
            error: 'MISSING_REQUIRED_FIELDS',
            missingFields: missingRequired,
            detectedMappings: autoMappings,
            headers: headers,
            message: practiceContext.language === 'he'
              ? `שדות חובה חסרים: ${missingRequired.join(', ')}. אנא ודא שקובץ ה-CSV מכיל עמודות אלו.`
              : `Missing required fields: ${missingRequired.join(', ')}. Please ensure the CSV file contains these columns.`
          };
        }

        console.log('✅ Auto-detected mappings:', autoMappings);
        parsedMappings = autoMappings;
      }

      const finalMappings = parsedMappings;
      
      // Convert mappings to use column indices
      const columnIndices = {};
      Object.entries(finalMappings).forEach(([field, value]) => {
        if (typeof value === 'string') {
          // It's a column name, find its index
          const index = headers.findIndex(h => h.toLowerCase() === value.toLowerCase());
          if (index !== -1) {
            columnIndices[field] = index;
          }
        } else if (typeof value === 'number') {
          columnIndices[field] = value;
        }
      });
      
      // Log the detected mappings for debugging
      console.log('📊 CSV Import - Detected column mappings:', {
        headers: headers,
        mappings: columnIndices,
        insuranceProviderColumn: columnIndices.insuranceProvider !== undefined ? headers[columnIndices.insuranceProvider] : 'NOT FOUND'
      });
      
      // Import patients
      const results = {
        success: [],
        updated: [],
        failed: [],
        duplicates: []
      };
      
      // Prepare all patient data first for validation
      const allPatientData = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        
        // Build patient data
        const rawDateOfBirth = columnIndices.dateOfBirth !== undefined ? values[columnIndices.dateOfBirth] : '';
        
        // Convert date format from MM/DD/YYYY to ISO format if needed
        let formattedDateOfBirth = rawDateOfBirth;
        if (rawDateOfBirth && rawDateOfBirth.includes('/')) {
          try {
            const [month, day, year] = rawDateOfBirth.split('/');
            if (month && day && year) {
              // Create ISO date string
              formattedDateOfBirth = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`).toISOString();
              console.log(`Converted date for row ${i}: ${rawDateOfBirth} -> ${formattedDateOfBirth}`);
            }
          } catch (dateError) {
            console.error(`Date conversion failed for row ${i}:`, {
              row: i,
              rawDate: rawDateOfBirth,
              error: dateError.message
            });
          }
        }
        
        const patientData = {
          firstName: columnIndices.firstName !== undefined ? values[columnIndices.firstName] : '',
          lastName: columnIndices.lastName !== undefined ? values[columnIndices.lastName] : '',
          email: columnIndices.email !== undefined ? values[columnIndices.email] : '',
          phone: columnIndices.phone !== undefined ? values[columnIndices.phone] : '',
          dateOfBirth: formattedDateOfBirth,
          gender: columnIndices.gender !== undefined ? values[columnIndices.gender] : '',
          street: columnIndices.street !== undefined ? values[columnIndices.street] : '',
          city: columnIndices.city !== undefined ? values[columnIndices.city] : '',
          state: columnIndices.state !== undefined ? values[columnIndices.state] : '',
          zipCode: columnIndices.zipCode !== undefined ? values[columnIndices.zipCode] : '',
          country: columnIndices.country !== undefined ? values[columnIndices.country] : detectedCountry,
          bloodType: columnIndices.bloodType !== undefined ? values[columnIndices.bloodType] : '',
          allergies: columnIndices.allergies !== undefined ? values[columnIndices.allergies] : '',
          emergencyContact: columnIndices.emergencyContact !== undefined ? values[columnIndices.emergencyContact] : '',
          emergencyContactPhone: columnIndices.emergencyContactPhone !== undefined ? values[columnIndices.emergencyContactPhone] : '',
          preferredLanguage: columnIndices.preferredLanguage !== undefined ? values[columnIndices.preferredLanguage] : 'English',
          status: columnIndices.status !== undefined ? values[columnIndices.status] : 'Active',
          doctorSummary: columnIndices.doctorSummary !== undefined ? values[columnIndices.doctorSummary] : '',
          practiceId: practiceContext.practiceId,
          rowIndex: i
        };
        
        // Handle country-specific fields
        if (isUSA) {
          // US patients need SSN and insurance provider
          patientData.socialSecurityNumber = columnIndices.socialSecurityNumber !== undefined ? values[columnIndices.socialSecurityNumber] : '';
          patientData.insuranceProvider = columnIndices.insuranceProvider !== undefined 
            ? normalizeInsuranceProvider(values[columnIndices.insuranceProvider]) 
            : '';
          patientData.insuranceNumber = columnIndices.insuranceNumber !== undefined ? values[columnIndices.insuranceNumber] : '';
            
          // Format SSN if provided
          if (patientData.socialSecurityNumber) {
            const digitsOnly = patientData.socialSecurityNumber.replace(/\D/g, '');
            if (digitsOnly.length === 9) {
              patientData.socialSecurityNumber = `${digitsOnly.substr(0,3)}-${digitsOnly.substr(3,2)}-${digitsOnly.substr(5,4)}`;
            }
          }
        } else if (isIsrael) {
          // Israeli patients need nationalId and healthFund
          patientData.nationalId = columnIndices.nationalId !== undefined ? values[columnIndices.nationalId] : '';
          if (columnIndices.insuranceProvider !== undefined) {
            // Map insurance to health fund for Israeli patients
            const insuranceValue = values[columnIndices.insuranceProvider];
            if (insuranceValue) {
              // Map common health fund names
              const healthFundMap = {
                'clalit': 'כללית',
                'maccabi': 'מכבי',
                'meuhedet': 'מאוחדת',
                'leumit': 'לאומית',
                'כללית': 'כללית',
                'מכבי': 'מכבי',
                'מאוחדת': 'מאוחדת',
                'לאומית': 'לאומית'
              };
              const normalized = insuranceValue.toLowerCase().trim();
              patientData.healthFund = healthFundMap[normalized] || insuranceValue;
            }
          }
        } else {
          // Other countries - use what's provided
          patientData.nationalId = columnIndices.nationalId !== undefined ? values[columnIndices.nationalId] : '';
          patientData.socialSecurityNumber = columnIndices.socialSecurityNumber !== undefined ? values[columnIndices.socialSecurityNumber] : '';
          patientData.insuranceProvider = columnIndices.insuranceProvider !== undefined 
            ? normalizeInsuranceProvider(values[columnIndices.insuranceProvider]) 
            : '';
        }
        
        allPatientData.push(patientData);
      }
      
      // Process patients in batches for better performance
      const BATCH_SIZE = 5;
      for (let batchStart = 0; batchStart < allPatientData.length; batchStart += BATCH_SIZE) {
        const batch = allPatientData.slice(batchStart, Math.min(batchStart + BATCH_SIZE, allPatientData.length));
        
        // Process batch in parallel
        const batchPromises = batch.map(async (patientData) => {
          const i = patientData.rowIndex;
          try {
          
            // Validate required fields
            if (!patientData.firstName || !patientData.lastName) {
              const error = practiceContext.language === 'he' 
                ? 'שם פרטי ושם משפחה נדרשים'
                : 'First name and last name are required';
              console.log(`❌ Patient validation failed - Row ${i}: ${patientData.firstName} ${patientData.lastName} - ${error}`);
              return {
                status: 'failed',
                row: i,
                data: patientData,
                error: error
              };
            }
            
            // Validate country-specific requirements
            if (isUSA) {
              if (!patientData.insuranceProvider) {
                return {
                  status: 'failed',
                  row: i,
                  data: patientData,
                  error: 'Insurance provider is required for US patients'
                };
              }
            } else if (isIsrael) {
              if (!patientData.healthFund) {
                return {
                  status: 'failed',
                  row: i,
                  data: patientData,
                  error: practiceContext.language === 'he'
                    ? 'קופת חולים נדרשת עבור מטופלים ישראלים'
                    : 'Health fund is required for Israeli patients'
                };
              }
            }
            
            // Check for duplicates based on unique identifiers
            let duplicateCheck = null;
            
            // First check by SSN or National ID if available
            if (isUSA && patientData.socialSecurityNumber) {
              const existingPatients = await SecureDataAccess.query(
                'patients',
                { socialSecurityNumber: patientData.socialSecurityNumber },
                { limit: 1 },
                context
              );
              if (existingPatients && existingPatients.length > 0) {
                duplicateCheck = existingPatients[0];
              }
            } else if (isIsrael && patientData.nationalId) {
              const existingPatients = await SecureDataAccess.query(
                'patients',
                { nationalId: patientData.nationalId },
                { limit: 1 },
                context
              );
              if (existingPatients && existingPatients.length > 0) {
                duplicateCheck = existingPatients[0];
              }
            }
            
            // If no ID-based duplicate found, check by name and date of birth
            if (!duplicateCheck) {
              const nameQuery = {
                firstName: { $regex: new RegExp(`^${patientData.firstName}$`, 'i') },
                lastName: { $regex: new RegExp(`^${patientData.lastName}$`, 'i') }
              };
              
              // Add date of birth to query if available for more precise matching
              if (patientData.dateOfBirth) {
                nameQuery.dateOfBirth = patientData.dateOfBirth;
              }
              
              const existingByName = await SecureDataAccess.query(
                'patients',
                nameQuery,
                { limit: 1 },
                context
              );
              
              if (existingByName && existingByName.length > 0) {
                duplicateCheck = existingByName[0];
                console.log(`⚠️ Found duplicate by name: ${patientData.firstName} ${patientData.lastName}`);
              }
            }
            
            if (duplicateCheck) {
              // Instead of skipping, update the existing patient with new data
              console.log(`📝 Updating existing patient: ${duplicateCheck.firstName} ${duplicateCheck.lastName} (ID: ${duplicateCheck._id})`);
              
              // Merge data - keep existing data but update with non-empty new values
              const updateData = {};
              Object.keys(patientData).forEach(key => {
                if (patientData[key] && key !== 'rowIndex' && key !== 'practiceId') {
                  // Only update if new value is not empty and different from existing
                  if (!duplicateCheck[key] || (duplicateCheck[key] !== patientData[key])) {
                    updateData[key] = patientData[key];
                  }
                }
              });
              
              if (Object.keys(updateData).length > 0) {
                // Update the existing patient
                await SecureDataAccess.update(
                  'patients',
                  { _id: duplicateCheck._id },
                  updateData,
                  context
                );
                
                return {
                  status: 'updated',
                  row: i,
                  patient: { ...duplicateCheck, ...updateData },
                  message: `Updated existing patient: ${duplicateCheck.firstName} ${duplicateCheck.lastName}`
                };
              } else {
                return {
                  status: 'duplicate',
                  row: i,
                  data: patientData,
                  existingPatient: duplicateCheck,
                  message: `Skipped - identical patient already exists`
                };
              }
            }
          
            // Clean up the patient data before creation
            const cleanedData = {};
            Object.keys(patientData).forEach(key => {
              if (patientData[key] && key !== 'rowIndex') {
                cleanedData[key] = patientData[key];
              }
            });
            
            // Log the data being sent to create
            console.log(`📝 Creating patient row ${i}: ${cleanedData.firstName} ${cleanedData.lastName}`);
            
            // Create the patient
            const newPatient = await SecureDataAccess.insert(
              'patients',
              cleanedData,
              context
            );
            
            console.log(`✅ Patient created successfully - Row ${i}: ${patientData.firstName} ${patientData.lastName}`);
            return {
              status: 'success',
              row: i,
              patient: newPatient
            };
            
          } catch (error) {
            console.error(`❌ Failed to create patient row ${i}: ${patientData.firstName} ${patientData.lastName}`, {
              error: error.message,
              stack: error.stack
            });
            return {
              status: 'failed',
              row: i,
              data: patientData,
              error: error.message
            };
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            const data = result.value;
            if (data.status === 'success') {
              results.success.push({
                row: data.row,
                patient: data.patient
              });
            } else if (data.status === 'updated') {
              results.updated.push({
                row: data.row,
                patient: data.patient,
                message: data.message
              });
            } else if (data.status === 'duplicate') {
              results.duplicates.push({
                row: data.row,
                data: data.data,
                existingPatient: data.existingPatient,
                message: data.message
              });
            } else if (data.status === 'failed') {
              results.failed.push({
                row: data.row,
                data: data.data,
                error: data.error
              });
            }
          } else {
            // Promise rejected
            results.failed.push({
              row: batchStart,
              error: `Batch processing error: ${result.reason}`
            });
          }
        });
        
        // Small delay between batches to avoid overwhelming the system
        if (batchStart + BATCH_SIZE < allPatientData.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Clean up the pending upload after successful import
      if (results.success.length > 0) {
        await SecureDataAccess.delete(
          'pendinguploads',
          { uploadId },
          context
        );
      }
      
      // Log the import results with cache statistics
      console.log('📊 CSV Import Results:', {
        successful: results.success.length,
        updated: results.updated.length,
        failed: results.failed.length,
        duplicates: results.duplicates.length,
        cacheNote: '💡 Enable Claude API caching by using cache_control on validation prompts'
      });
      
      // Prepare summary message
      const summary = [];
      if (results.success.length > 0) {
        summary.push(practiceContext.language === 'he' 
          ? `${results.success.length} מטופלים חדשים נוספו`
          : `${results.success.length} new patients added`);
      }
      if (results.updated.length > 0) {
        summary.push(practiceContext.language === 'he' 
          ? `${results.updated.length} מטופלים עודכנו`
          : `${results.updated.length} patients updated`);
      }
      if (results.duplicates.length > 0) {
        summary.push(practiceContext.language === 'he' 
          ? `${results.duplicates.length} מטופלים זהים כבר קיימים`
          : `${results.duplicates.length} identical patients skipped`);
      }
      if (results.failed.length > 0) {
        summary.push(practiceContext.language === 'he' 
          ? `${results.failed.length} רשומות נכשלו`
          : `${results.failed.length} records failed`);
      }
      
      return {
        success: true,
        data: {
          imported: results.success.length,
          updated: results.updated.length,
          duplicates: results.duplicates.length,
          failed: results.failed.length,
          total: lines.length - 1,
          details: results
        },
        message: summary.join(', '),
        summary: {
          fileName: file.originalName,
          totalRows: lines.length - 1,
          imported: results.success.length,
          updated: results.updated.length,
          skipped: results.duplicates.length,
          failed: results.failed.length
        }
      };
      
    } catch (error) {
      console.error('Error importing patients from CSV:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בייבוא מטופלים: ${error.message}`
          : `Error importing patients: ${error.message}`
      };
    }
  }

async getPatientsNeedingFollowUp(params, practiceContext, session) {
    try {
      const { dateRange = 'week', urgency = 'all', department, limit = 50 } = params;
      
      // Build security context
      const context = AgentServiceHelpers.buildSecurityContext(
        'patientService',
        this.serviceToken,
        practiceContext
      );
      
      // Build date filter based on range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let dateFilter = {};
      switch (dateRange) {
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          dateFilter = {
            date: {
              $gte: today.toISOString().split('T')[0],
              $lt: tomorrow.toISOString().split('T')[0]
            }
          };
          break;
        case 'week':
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          dateFilter = {
            date: {
              $gte: today.toISOString().split('T')[0],
              $lte: nextWeek.toISOString().split('T')[0]
            }
          };
          break;
        case 'month':
          const nextMonth = new Date(today);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          dateFilter = {
            date: {
              $gte: today.toISOString().split('T')[0],
              $lte: nextMonth.toISOString().split('T')[0]
            }
          };
          break;
        case 'overdue':
          dateFilter = {
            date: { $lt: today.toISOString().split('T')[0], $ne: "" }
          };
          break;
        case 'all':
        default:
          // Return all appointments with dates (not empty dates)
          dateFilter = {
            $or: [
              { date: { $ne: "" } },
              { reason: { $ne: "" } }
            ]
          };
          break;
      }

      // Build full query - follow_up_appointments doesn't have status field like regular appointments
      const filter = {
        ...dateFilter
      };
      
      // Note: follow_up_appointments collection doesn't have urgency field
      // Instead we can filter by provider field which contains department-like info
      if (department) {
        filter.$or = filter.$or || [];
        filter.$or.push(
          { provider: { $regex: department, $options: 'i' } },
          { department: { $regex: department, $options: 'i' } }
        );
      }
      
      // Query follow_up_appointments collection
      const followUps = await SecureDataAccess.query(
        'follow_up_appointments',
        filter,
        {
          limit,
          sort: { date: 1, reason: 1 }
        },
        context
      );
      
      // Get patient details for each follow-up
      const patientIds = [...new Set(followUps.map(f => f.patientId))];
      const patients = await SecureDataAccess.query(
        'patients',
        { _id: { $in: patientIds.map(id => new ObjectId(id)) } },
        {},
        context
      );

      // Create patient map
      const patientMap = {};
      patients.forEach(p => {
        patientMap[p._id.toString()] = p;
      });

      // Check for actual appointments that match these follow-ups
      // Query appointments collection to find which follow-ups have real appointments
      const appointmentFilter = {
        patientId: { $in: patientIds },
        // Match appointments within reasonable date range of follow-ups
        date: {
          $gte: today.toISOString().split('T')[0],
          $lte: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Next 90 days
        },
        status: { $ne: 'cancelled' }
      };

      const appointments = await SecureDataAccess.query(
        'appointments',
        appointmentFilter,
        {},
        context
      );

      // Create appointment map by patient and date for matching
      const appointmentMap = {};
      appointments.forEach(apt => {
        const key = `${apt.patientId}_${apt.date}`;
        appointmentMap[key] = apt;
      });
      
      // Helper function to format date based on language
      const formatDate = (dateString, language) => {
        if (!dateString || dateString === 'Not scheduled') return dateString;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        // For English: MM/DD/YYYY
        if (language !== 'he') {
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const year = date.getFullYear();
          return `${month}/${day}/${year}`;
        }
        // For Hebrew keep DD/MM/YYYY
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      // Create formatted grid data with clear patient information
      const gridData = followUps.map(followUp => {
        const patient = patientMap[followUp.patientId] || {
          firstName: 'Unknown',
          lastName: 'Patient',
          dateOfBirth: null
        };

        // Check if there's an actual appointment for this follow-up
        const appointmentKey = `${followUp.patientId}_${followUp.date}`;
        const hasAppointment = appointmentMap[appointmentKey] ? true : false;

        // Determine priority based on whether appointment exists
        let priority;
        if (hasAppointment) {
          priority = 'Scheduled';
        } else {
          priority = 'Needs Scheduling';
        }

        return {
          patientId: followUp.patientId,
          patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unknown Patient',
          patientAge: patient.dateOfBirth ?
            Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A',
          followUpDate: formatDate(followUp.date, practiceContext.language) || 'Not scheduled',
          followUpTime: hasAppointment && appointmentMap[appointmentKey].time ?
            appointmentMap[appointmentKey].time : 'Not specified',
          department: followUp.department || 'General',
          doctor: followUp.provider || 'Not assigned',
          reason: followUp.reason || 'Not specified',
          notes: followUp.notes || '',
          documentId: followUp.documentId,
          createdAt: followUp._securityMetadata?.createdAt,
          priority: priority
        };
      });

      // Sort by priority (scheduled first) and then by date
      gridData.sort((a, b) => {
        if (a.priority === 'Scheduled' && b.priority === 'Needs Scheduling') return -1;
        if (a.priority === 'Needs Scheduling' && b.priority === 'Scheduled') return 1;
        if (a.followUpDate && b.followUpDate && a.followUpDate !== 'Not scheduled' && b.followUpDate !== 'Not scheduled') {
          // Parse dates properly for sorting (handle MM/DD/YYYY format)
          const parseDate = (dateStr) => {
            if (dateStr.includes('/')) {
              const parts = dateStr.split('/');
              if (parts.length === 3) {
                // Assume MM/DD/YYYY for English
                if (practiceContext.language !== 'he') {
                  return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
                }
                // DD/MM/YYYY for Hebrew
                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
            }
            return new Date(dateStr);
          };
          return parseDate(a.followUpDate) - parseDate(b.followUpDate);
        }
        return 0;
      });

      // Create summary statistics
      const stats = {
        total: gridData.length,
        scheduled: gridData.filter(item => item.priority === 'Scheduled').length,
        pendingSchedule: gridData.filter(item => item.priority === 'Needs Scheduling').length,
        doctors: [...new Set(gridData.map(item => item.doctor).filter(doc => doc !== 'Not assigned'))]
      };

      // Use GridFormatter for consistent formatting
      const gridFormatter = require('./gridFormatterService');
      const baseResult = {
        success: true,
        data: gridData,
        statistics: stats,
        message: practiceContext.language === 'he'
          ? `נמצאו ${gridData.length} מטופלים הזקוקים למעקב (${stats.scheduled} מתוזמנים, ${stats.pendingSchedule} ממתינים לתיאום)`
          : `Found ${gridData.length} patients needing follow-up (${stats.scheduled} scheduled, ${stats.pendingSchedule} need scheduling)`
      };

      console.log('📊 [getPatientsNeedingFollowUp] Calling gridFormatter with:', {
        functionName: 'getPatientsNeedingFollowUp',
        dataCount: gridData.length,
        language: practiceContext.language,
        statistics: stats
      });

      // Apply grid formatting
      const formattedResult = gridFormatter.formatForDisplay('getPatientsNeedingFollowUp', baseResult, practiceContext.language, practiceContext);

      console.log('✅ [getPatientsNeedingFollowUp] Grid formatted result:', {
        gridFormat: formattedResult.gridFormat,
        columns: formattedResult.columns,
        headers: formattedResult.headers,
        dataLength: formattedResult.data?.length,
        displayTitle: formattedResult.displayTitle
      });

      return formattedResult;
      
    } catch (error) {
      console.error('Error getting patients needing follow-up:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בחיפוש מטופלים למעקב'
          : 'Error searching for patients needing follow-up'
      };
    }
  }

async getPatientFollowUpDetails(params, practiceContext, session) {
    try {
      const { patientId, includeHistory = false } = params;
      
      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: practiceContext.language === 'he'
            ? 'מזהה מטופל חסר'
            : 'Patient ID is required'
        };
      }
      
      // Build security context
      const context = AgentServiceHelpers.buildSecurityContext(
        'patientService',
        this.serviceToken,
        practiceContext
      );
      
      // Convert patientId to ObjectId if needed
      const patientObjectId = typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) 
        ? new ObjectId(patientId) 
        : patientId;
      
      // Get patient details first
      const patients = await SecureDataAccess.query(
        'patients',
        { _id: patientObjectId },
        { limit: 1 },
        context
      );
      
      const patient = patients[0];
      if (!patient) {
        return {
          success: false,
          error: 'PATIENT_NOT_FOUND',
          message: practiceContext.language === 'he'
            ? 'מטופל לא נמצא'
            : 'Patient not found'
        };
      }
      
      // Get follow-ups for this patient
      const filter = {
        patientId: patientId,
        status: includeHistory 
          ? {} // All statuses
          : { $in: ['pending', 'scheduled'] } // Only active follow-ups
      };
      
      const followUps = await SecureDataAccess.query(
        'follow_up_appointments',
        filter,
        { sort: { followUpDate: -1 } },
        context
      );
      
      return {
        success: true,
        data: {
          patient: {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`,
            nationalId: patient.nationalId
          },
          followUps: followUps,
          totalFollowUps: followUps.length,
          pendingFollowUps: followUps.filter(f => f.status === 'pending').length,
          overdueFollowUps: followUps.filter(f => 
            f.status === 'pending' && new Date(f.followUpDate) < new Date()
          ).length
        },
        message: practiceContext.language === 'he'
          ? `נמצאו ${followUps.length} מעקבים עבור ${patient.firstName} ${patient.lastName}`
          : `Found ${followUps.length} follow-ups for ${patient.firstName} ${patient.lastName}`
      };
      
    } catch (error) {
      console.error('Error getting patient follow-up details:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בטעינת פרטי מעקב'
          : 'Error loading follow-up details'
      };
    }
  }

async scheduleFollowUp(params, practiceContext, session) {
    try {
      const { patientId, followUpDate, appointmentDate, appointmentTime, reason, urgency = 'medium', department, specialty, notes } = params;

      // Support both parameter styles: new (appointmentDate + appointmentTime) and legacy (followUpDate)
      let finalFollowUpDate;
      if (appointmentDate) {
        // New parameter style: appointmentDate + appointmentTime
        if (appointmentTime) {
          finalFollowUpDate = `${appointmentDate}T${appointmentTime}:00`;
        } else {
          finalFollowUpDate = appointmentDate;
        }
      } else if (followUpDate) {
        // Legacy parameter style: followUpDate
        finalFollowUpDate = followUpDate;
      }

      if (!patientId || !finalFollowUpDate || !reason) {
        return {
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: practiceContext.language === 'he'
            ? 'חסרים שדות חובה: מזהה מטופל, תאריך מעקב וסיבה'
            : 'Missing required fields: patient ID, follow-up date and reason'
        };
      }

      // Build security context
      const context = AgentServiceHelpers.buildSecurityContext(
        'patientService',
        this.serviceToken,
        practiceContext
      );

      // Get practice to access timezone
      console.log(`🔍 [scheduleFollowUp] practiceContext.practiceId:`, practiceContext.practiceId);

      const practices = await SecureDataAccess.query(
        'practices',
        { subdomain: practiceContext.practiceId },
        { limit: 1 },
        context
      );

      console.log(`🔍 [scheduleFollowUp] Practices query returned:`, practices);

      const practice = practices && practices[0];
      const timezone = practice?.settings?.timezone || 'UTC';

      console.log(`🔍 [scheduleFollowUp] Resolved timezone:`, timezone);

      // Generate timestamps in practice local timezone
      const timestamps = getTimestampForDocument(timezone);

      // Create follow-up record
      const followUpRecord = {
        patientId,
        followUpDate: new Date(finalFollowUpDate),
        reason,
        urgency,
        department: department || specialty || 'General',
        notes,
        status: 'scheduled',
        ...timestamps,  // createdAt, createdAtUTC, createdAtTimezone, updatedAt, updatedAtUTC, updatedAtTimezone
        createdBy: session?.userId || 'system'
      };

      const result = await SecureDataAccess.insert(
        'follow_up_appointments',
        followUpRecord,
        context
      );

      // Create metadata in GLOBAL database for cron job to process
      const globalContext = {
        serviceId: 'patient-service',
        practiceId: 'global',
        operation: 'createFollowUpMetadata',
        userId: session?.userId || 'system'
      };

      const metadata = {
        followUpId: result.insertedId,
        practiceId: practiceContext.practiceId,
        patientId: patientId,
        scheduledDate: new Date(finalFollowUpDate),
        processed: false,
        createdAt: new Date()
      };

      await SecureDataAccess.insert(
        'follow_up_metadata',
        metadata,
        globalContext
      );

      console.log(`📋 [scheduleFollowUp] Created metadata for follow-up ${result.insertedId} in global database`);

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? `מעקב נקבע בהצלחה ל-${new Date(finalFollowUpDate).toLocaleDateString('he-IL')}`
          : `Follow-up scheduled successfully for ${new Date(finalFollowUpDate).toLocaleDateString('en-US')}`
      };
      
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בקביעת מעקב'
          : 'Error scheduling follow-up'
      };
    }
  }

async updateFollowUpStatus(params, practiceContext, session) {
    try {
      const { followUpId, status, completionNotes, newDate } = params;
      
      if (!followUpId || !status) {
        return {
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: practiceContext.language === 'he'
            ? 'חסרים שדות חובה: מזהה מעקב וסטטוס'
            : 'Missing required fields: follow-up ID and status'
        };
      }
      
      // Build security context
      const context = AgentServiceHelpers.buildSecurityContext(
        'patientService',
        this.serviceToken,
        practiceContext
      );
      
      // Build update object
      const updates = {
        status,
        updatedAt: new Date(),
        updatedBy: session?.userId || 'system'
      };
      
      if (completionNotes) {
        updates.completionNotes = completionNotes;
      }
      
      if (status === 'completed') {
        updates.completedAt = new Date();
      }

      if (status === 'rescheduled' && newDate) {
        updates.scheduledDate = new Date(newDate);  // Fixed: Use scheduledDate not followUpDate
        updates.rescheduledFrom = followUpId;
      }
      
      // Update the follow-up
      const result = await SecureDataAccess.update(
        'follow_up_appointments',
        { _id: new ObjectId(followUpId) },
        { $set: updates },
        context
      );
      
      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? `סטטוס המעקב עודכן ל-${status}`
          : `Follow-up status updated to ${status}`
      };
      
    } catch (error) {
      console.error('Error updating follow-up status:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בעדכון סטטוס מעקב'
          : 'Error updating follow-up status'
      };
    }
  }

async deleteFollowUp(params, practiceContext, session) {
    try {
      const { followUpId, reason } = params;
      
      if (!followUpId) {
        return {
          success: false,
          error: 'MISSING_FOLLOW_UP_ID',
          message: practiceContext.language === 'he'
            ? 'מזהה מעקב חסר'
            : 'Follow-up ID is required'
        };
      }
      
      // Build security context
      const context = AgentServiceHelpers.buildSecurityContext(
        'patientService',
        this.serviceToken,
        practiceContext
      );
      
      // Store deletion audit before removing
      if (reason) {
        await SecureDataAccess.insert(
          'audit_logs',
          {
            action: 'DELETE_FOLLOW_UP',
            followUpId,
            reason,
            deletedBy: session?.userId || 'system',
            deletedAt: new Date()
          },
          context
        );
      }
      
      // Delete the follow-up
      const result = await SecureDataAccess.delete(
        'follow_up_appointments',
        { _id: new ObjectId(followUpId) },
        context
      );
      
      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? 'המעקב נמחק בהצלחה'
          : 'Follow-up deleted successfully'
      };
      
    } catch (error) {
      console.error('Error deleting follow-up:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה במחיקת מעקב'
          : 'Error deleting follow-up'
      };
    }
  }

async getPatientsForFollowUp(params, practiceContext, session) {
    try {
      const { condition, dateRange = 'week', urgentOnly = false, provider } = params;

      const context = {
        serviceId: this.serviceName,
        operation: 'getPatientsForFollowUp',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId || (() => {
          console.error('❌ Practice ID missing in recordConsent! practiceContext:', practiceContext);
          throw new Error('Practice context is required for consent management');
        })(),
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Build date filter
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let dateFilter = {};

      switch(dateRange) {
        case 'today':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          dateFilter = {
            'medicalConditions.nextFollowUp': {
              $gte: today,
              $lt: tomorrow
            }
          };
          break;
        case 'week':
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          dateFilter = {
            'medicalConditions.nextFollowUp': {
              $gte: today,
              $lte: nextWeek
            }
          };
          break;
        case 'month':
          const nextMonth = new Date(today);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          dateFilter = {
            'medicalConditions.nextFollowUp': {
              $gte: today,
              $lte: nextMonth
            }
          };
          break;
        case 'overdue':
          dateFilter = {
            'medicalConditions.nextFollowUp': { $lt: today },
            'medicalConditions.followUpRequired': true
          };
          break;
      }

      // Build main filter
      const filter = {
        ...dateFilter,
        'medicalConditions.followUpRequired': true,
        'medicalConditions.status': { $in: ['active', 'chronic'] }
      };

      if (condition) {
        filter['medicalConditions.condition'] = new RegExp(condition, 'i');
      }

      if (urgentOnly) {
        filter['medicalConditions.severity'] = { $in: ['severe', 'critical'] };
      }

      if (provider) {
        filter['medicalConditions.managingProvider'] = provider;
      }

      const patients = await SecureDataAccess.query(
        'patients',
        filter,
        {
          sort: { 'medicalConditions.nextFollowUp': 1 },
          limit: 200
        },
        context
      );

      // Format and group results
      const results = patients.map(patient => {
        const followUpConditions = patient.medicalConditions?.filter(c =>
          c.followUpRequired &&
          (!condition || c.condition.toLowerCase().includes(condition.toLowerCase()))
        ) || [];

        return {
          patientId: patient._id,
          name: `${patient.firstName} ${patient.lastName}`,
          phone: patient.phone,
          email: patient.email,
          conditions: followUpConditions.map(c => ({
            condition: c.condition,
            nextFollowUp: c.nextFollowUp,
            severity: c.severity,
            provider: c.managingProvider,
            daysSinceLastVisit: c.lastVisit ?
              Math.floor((today - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24)) : null
          }))
        };
      }).filter(p => p.conditions.length > 0);

      // Group by urgency
      const urgent = results.filter(p =>
        p.conditions.some(c => c.nextFollowUp < today)
      );
      const today_appointments = results.filter(p =>
        p.conditions.some(c => {
          const followUp = new Date(c.nextFollowUp);
          return followUp.toDateString() === today.toDateString();
        })
      );
      const upcoming = results.filter(p =>
        p.conditions.every(c => new Date(c.nextFollowUp) > today)
      );

      return {
        success: true,
        data: {
          urgent: urgent,
          today: today_appointments,
          upcoming: upcoming,
          total: results.length
        },
        message: practiceContext.language === 'he'
          ? `נמצאו ${results.length} מטופלים הזקוקים למעקב`
          : `Found ${results.length} patients requiring follow-up`
      };

    } catch (error) {
      console.error('Error getting patients for follow-up:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בשליפת מטופלים למעקב'
          : 'Error getting patients for follow-up'
      };
    }
  }

async addPatientCondition(params, practiceContext, session) {
    try {
      const {
        patientId,
        condition,
        icdCode,
        diagnosisDate = new Date(),
        severity = 'moderate',
        status = 'active',
        followUpRequired = false,
        nextFollowUp,
        managingProvider
      } = params;

      if (!patientId || !condition) {
        return {
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: practiceContext.language === 'he'
            ? 'נדרשים מזהה מטופל ושם המצב הרפואי'
            : 'Patient ID and condition name are required'
        };
      }

      const context = {
        serviceId: this.serviceName,
        operation: 'addPatientCondition',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId || (() => {
          console.error('❌ Practice ID missing in recordConsent! practiceContext:', practiceContext);
          throw new Error('Practice context is required for consent management');
        })(),
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Create condition record
      const conditionRecord = {
        condition,
        icdCode,
        diagnosisDate: new Date(diagnosisDate),
        severity,
        status,
        followUpRequired,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
        managingProvider,
        addedAt: new Date(),
        lastUpdated: new Date()
      };

      // Update patient record
      const result = await SecureDataAccess.update(
        'patients',
        { _id: new ObjectId(patientId) },
        {
          $push: { medicalConditions: conditionRecord },
          $set: { lastUpdated: new Date() }
        },
        context
      );

      // Also create a record in the specific condition collection if it exists
      const conditionCollection = this.getConditionCollectionName(condition);
      if (conditionCollection) {
        await SecureDataAccess.insert(
          conditionCollection,
          {
            patientId: new ObjectId(patientId),
            ...conditionRecord,
            source: 'agent'
          },
          context
        );
      }

      return {
        success: true,
        data: conditionRecord,
        message: practiceContext.language === 'he'
          ? `המצב הרפואי ${condition} נוסף בהצלחה`
          : `Medical condition ${condition} added successfully`
      };

    } catch (error) {
      console.error('Error adding patient condition:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בהוספת מצב רפואי'
          : 'Error adding medical condition'
      };
    }
  }

async updatePatientCondition(params, practiceContext, session) {
    try {
      const {
        patientId,
        condition,
        updates
      } = params;

      if (!patientId || !condition || !updates) {
        return {
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: practiceContext.language === 'he'
            ? 'נדרשים מזהה מטופל, שם המצב ופרטים לעדכון'
            : 'Patient ID, condition name and updates are required'
        };
      }

      const context = {
        serviceId: this.serviceName,
        operation: 'updatePatientCondition',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId || (() => {
          console.error('❌ Practice ID missing in recordConsent! practiceContext:', practiceContext);
          throw new Error('Practice context is required for consent management');
        })(),
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Prepare update object
      const updateObj = {};
      Object.keys(updates).forEach(key => {
        updateObj[`medicalConditions.$.${key}`] = updates[key];
      });
      updateObj['medicalConditions.$.lastUpdated'] = new Date();

      // Update patient record
      const result = await SecureDataAccess.update(
        'patients',
        {
          _id: new ObjectId(patientId),
          'medicalConditions.condition': condition
        },
        { $set: updateObj },
        context
      );

      return {
        success: true,
        data: result,
        message: practiceContext.language === 'he'
          ? `המצב הרפואי ${condition} עודכן בהצלחה`
          : `Medical condition ${condition} updated successfully`
      };

    } catch (error) {
      console.error('Error updating patient condition:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בעדכון מצב רפואי'
          : 'Error updating medical condition'
      };
    }
  }

async getPatientConditions(params, practiceContext, session) {
    try {
      const { patientId, activeOnly = false } = params;

      if (!patientId) {
        return {
          success: false,
          error: 'MISSING_PATIENT_ID',
          message: practiceContext.language === 'he'
            ? 'נדרש מזהה מטופל'
            : 'Patient ID is required'
        };
      }

      const context = {
        serviceId: this.serviceName,
        operation: 'getPatientConditions',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId || (() => {
          console.error('❌ Practice ID missing in recordConsent! practiceContext:', practiceContext);
          throw new Error('Practice context is required for consent management');
        })(),
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Get patient with conditions
      // Handle patientId - it might already be an ObjectId or a string
      let patientIdToUse = patientId;
      if (typeof patientId === 'string' && /^[0-9a-fA-F]{24}$/.test(patientId)) {
        patientIdToUse = new ObjectId(patientId);
      }

      const patient = await SecureDataAccess.query(
        'patients',
        { _id: patientIdToUse },
        { limit: 1 },
        context
      );

      if (!patient || patient.length === 0) {
        return {
          success: false,
          error: 'PATIENT_NOT_FOUND',
          message: practiceContext.language === 'he'
            ? 'מטופל לא נמצא'
            : 'Patient not found'
        };
      }

      let conditions = patient[0].medicalConditions || [];

      if (activeOnly) {
        conditions = conditions.filter(c =>
          c.status === 'active' || c.status === 'chronic'
        );
      }

      // Sort by diagnosis date (most recent first)
      conditions.sort((a, b) =>
        new Date(b.diagnosisDate) - new Date(a.diagnosisDate)
      );

      return {
        success: true,
        data: {
          patientName: `${patient[0].firstName} ${patient[0].lastName}`,
          conditions: conditions,
          totalConditions: conditions.length,
          activeConditions: conditions.filter(c => c.status === 'active').length,
          chronicConditions: conditions.filter(c => c.status === 'chronic').length,
          resolvedConditions: conditions.filter(c => c.status === 'resolved').length,
          requiresFollowUp: conditions.some(c => c.followUpRequired)
        },
        message: practiceContext.language === 'he'
          ? `נמצאו ${conditions.length} מצבים רפואיים`
          : `Found ${conditions.length} medical conditions`
      };

    } catch (error) {
      console.error('Error getting patient conditions:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בשליפת מצבים רפואיים'
          : 'Error getting medical conditions'
      };
    }
  }

async getConditionStatistics(params, practiceContext, session) {
    try {
      const { condition, dateRange = 'all' } = params;

      const context = {
        serviceId: this.serviceName,
        operation: 'getConditionStatistics',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId || (() => {
          console.error('❌ Practice ID missing in getConditionStatistics! practiceContext:', practiceContext);
          throw new Error('Practice context is required');
        })(),
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      console.log(`🔍 Searching for medical conditions${condition ? ` matching: ${condition}` : ''}`);

      // Map to store all patient conditions
      let allPatientsWithConditions = new Map();
      let conditionStats = new Map();

      // 1. Search in past_medical_history collection (primary source)
      const medicalHistoryFilter = condition
        ? { conditions: { $elemMatch: { $regex: condition, $options: 'i' } } }
        : { conditions: { $exists: true, $ne: [] } };

      const medicalHistory = await SecureDataAccess.query(
        'past_medical_history',
        medicalHistoryFilter,
        { limit: 1000 },
        context
      );
      console.log(`📊 Found ${medicalHistory.length} past medical history records`);

      // Process medical history conditions
      medicalHistory.forEach(mh => {
        if (mh.patientId && mh.conditions && Array.isArray(mh.conditions)) {
          if (!allPatientsWithConditions.has(mh.patientId)) {
            allPatientsWithConditions.set(mh.patientId, new Set());
          }
          mh.conditions.forEach(cond => {
            allPatientsWithConditions.get(mh.patientId).add(cond);
            // Update condition statistics
            if (!conditionStats.has(cond)) {
              conditionStats.set(cond, { count: 0, patients: new Set() });
            }
            conditionStats.get(cond).count++;
            conditionStats.get(cond).patients.add(mh.patientId);
          });
        }
      });

      // 2. Search in diagnoses collection (secondary source)
      const diagnosesFilter = condition
        ? { diagnosis: new RegExp(condition, 'i') }
        : {};

      const diagnoses = await SecureDataAccess.query(
        'diagnoses',
        diagnosesFilter,
        { limit: 1000 },
        context
      );
      console.log(`📊 Found ${diagnoses.length} diagnoses records`);

      // Process diagnoses
      diagnoses.forEach(d => {
        if (d.patientId && d.diagnosis) {
          if (!allPatientsWithConditions.has(d.patientId)) {
            allPatientsWithConditions.set(d.patientId, new Set());
          }
          allPatientsWithConditions.get(d.patientId).add(d.diagnosis);
          // Update condition statistics
          if (!conditionStats.has(d.diagnosis)) {
            conditionStats.set(d.diagnosis, { count: 0, patients: new Set() });
          }
          conditionStats.get(d.diagnosis).count++;
          conditionStats.get(d.diagnosis).patients.add(d.patientId);
        }
      });

      // Get patient details for found patient IDs
      const patientIds = Array.from(allPatientsWithConditions.keys());
      let patients = [];

      if (patientIds.length > 0) {
        const { ObjectId } = require('mongodb');
        patients = await SecureDataAccess.query(
          'patients',
          {
            _id: {
              $in: patientIds.map(id => {
                try {
                  return ObjectId.isValid(id) ? new ObjectId(id) : id;
                } catch(e) {
                  return id;
                }
              })
            }
          },
          { limit: 1000 },
          context
        );
      }

      console.log(`👥 Found ${patients.length} patients with conditions`);

      // Build detailed patient list with conditions
      const patientsWithConditions = patients.map(p => {
        const patientConditions = Array.from(allPatientsWithConditions.get(p._id?.toString()) || []);
        return {
          patientId: p._id,
          firstName: p.firstName,
          lastName: p.lastName,
          fullName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
          dateOfBirth: p.dateOfBirth,
          age: p.dateOfBirth ? Math.floor((new Date() - new Date(p.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null,
          phone: p.phone,
          email: p.email,
          conditions: patientConditions,
          conditionCount: patientConditions.length,
          hasMultipleConditions: patientConditions.length > 1
        };
      }).sort((a, b) => b.conditionCount - a.conditionCount);

      // Convert condition statistics to sorted array
      const sortedConditionStats = Array.from(conditionStats.entries())
        .map(([name, stats]) => ({
          condition: name,
          totalOccurrences: stats.count,
          uniquePatients: stats.patients.size,
          patientList: Array.from(stats.patients)
        }))
        .sort((a, b) => b.totalOccurrences - a.totalOccurrences);

      // Top 10 most common conditions
      const topConditions = sortedConditionStats.slice(0, 10);

      // Calculate time-based statistics if we have date information
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

      // Time statistics from diagnoses with dates
      const timeStats = {
        lastMonth: diagnoses.filter(d => d.date && new Date(d.date) >= oneMonthAgo).length,
        lastQuarter: diagnoses.filter(d => d.date && new Date(d.date) >= threeMonthsAgo).length,
        lastYear: diagnoses.filter(d => d.date && new Date(d.date) >= oneYearAgo).length,
        total: diagnoses.length + medicalHistory.length
      };

      // Find patients with multiple conditions
      const multiConditionPatients = patientsWithConditions
        .filter(p => p.conditionCount > 1)
        .slice(0, 10)
        .map(p => ({
          name: p.fullName || 'Unknown',
          patientId: p.patientId,
          conditionCount: p.conditionCount,
          conditions: p.conditions.join(', ')
        }));

      // Calculate summary statistics
      const totalUniqueConditions = conditionStats.size;
      const patientsWithAnyCondition = allPatientsWithConditions.size;
      const totalConditionRecords = Array.from(conditionStats.values()).reduce((sum, stat) => sum + stat.count, 0);

      // Build informative response message
      let detailedMessage = '';

      if (patientsWithAnyCondition === 0) {
        detailedMessage = condition
          ? `No patients found with conditions matching "${condition}".\n\nTry searching without filters or check if medical data has been imported.`
          : `No medical conditions found in the database.\n\nThe system appears to have no medical condition data recorded yet.`;
      } else {
        const lang = practiceContext.language;

        if (condition) {
          detailedMessage = lang === 'he'
            ? `נמצאו ${patientsWithAnyCondition} מטופלים עם מצבים התואמים "${condition}"\n\n`
            : `Found ${patientsWithAnyCondition} patients with conditions matching "${condition}"\n\n`;
        } else {
          detailedMessage = lang === 'he'
            ? `סטטיסטיקות מצבים רפואיים:\n\n`
            : `Medical Condition Statistics:\n\n`;
        }

        // Show top conditions
        detailedMessage += lang === 'he' ? `מצבים נפוצים:\n` : `Most Common Conditions:\n`;
        topConditions.slice(0, 5).forEach((c, i) => {
          detailedMessage += `${i + 1}. ${c.condition} - ${c.uniquePatients} ${lang === 'he' ? 'מטופלים' : 'patients'}\n`;
        });

        // Show sample patients
        if (patientsWithConditions.length > 0) {
          detailedMessage += lang === 'he' ? `\nדוגמאות מטופלים:\n` : `\nSample Patients:\n`;
          patientsWithConditions.slice(0, 5).forEach((p, i) => {
            const conditions = p.conditions.slice(0, 3).join(', ');
            detailedMessage += `${i + 1}. ${p.fullName || 'Unknown'}: ${conditions}${p.conditions.length > 3 ? '...' : ''}\n`;
          });
        }

        // Summary stats
        detailedMessage += lang === 'he'
          ? `\nסה"כ: ${patientsWithAnyCondition} מטופלים, ${totalUniqueConditions} מצבים שונים`
          : `\nTotal: ${patientsWithAnyCondition} patients, ${totalUniqueConditions} unique conditions`;
      }

      // Build a comprehensive response with better formatting
      let formattedDisplay = '';
      const lang = practiceContext.language;

      if (patientsWithAnyCondition === 0) {
        formattedDisplay = condition
          ? `No patients found with conditions matching "${condition}".`
          : `No medical conditions found in the database.`;
      } else {
        // Title
        formattedDisplay = condition
          ? `📋 **PATIENTS WITH "${condition.toUpperCase()}"**\n`
          : `📋 **MEDICAL CONDITIONS OVERVIEW**\n`;

        formattedDisplay += `${'─'.repeat(50)}\n\n`;

        // Summary Stats
        formattedDisplay += `📊 **SUMMARY STATISTICS:**\n`;
        formattedDisplay += `• Total Patients Analyzed: **${patientsWithAnyCondition}**\n`;
        formattedDisplay += `• Total Unique Conditions: **${totalUniqueConditions}**\n`;
        formattedDisplay += `• Total Condition Records: **${totalConditionRecords}**\n`;
        formattedDisplay += `• Average Conditions per Patient: **${patientsWithAnyCondition > 0 ? (totalConditionRecords / patientsWithAnyCondition).toFixed(1) : 0}**\n\n`;

        // Top Conditions
        if (topConditions.length > 0) {
          formattedDisplay += `🔝 **TOP ${Math.min(5, topConditions.length)} MOST COMMON CONDITIONS:**\n`;
          topConditions.slice(0, 5).forEach((c, i) => {
            const percentage = ((c.uniquePatients / patientsWithAnyCondition) * 100).toFixed(1);
            formattedDisplay += `${i + 1}. **${c.condition}**\n`;
            formattedDisplay += `   • ${c.uniquePatients} patients (${percentage}% of total)\n`;
            formattedDisplay += `   • ${c.totalOccurrences} total occurrences\n`;
          });
          formattedDisplay += `\n`;
        }

        // Patients with conditions
        if (patientsWithConditions.length > 0) {
          formattedDisplay += `👥 **PATIENT DETAILS** (Showing ${Math.min(5, patientsWithConditions.length)} of ${patientsWithConditions.length}):\n`;
          patientsWithConditions.slice(0, 5).forEach((p, i) => {
            formattedDisplay += `\n${i + 1}. **${p.fullName || 'Unknown Patient'}**`;
            if (p.age !== null) formattedDisplay += ` (Age: ${p.age})`;
            formattedDisplay += `\n`;
            formattedDisplay += `   • Conditions (${p.conditionCount}): ${p.conditions.slice(0, 3).join(', ')}`;
            if (p.conditions.length > 3) formattedDisplay += ` +${p.conditions.length - 3} more`;
            formattedDisplay += `\n`;
          });
        }

        // Multi-condition patients
        if (multiConditionPatients.length > 0) {
          formattedDisplay += `\n🏥 **PATIENTS WITH MULTIPLE CONDITIONS:**\n`;
          multiConditionPatients.slice(0, 3).forEach(p => {
            formattedDisplay += `• ${p.name}: **${p.conditionCount} conditions**\n`;
          });
        }

        // Action suggestions
        formattedDisplay += `\n${'─'.repeat(50)}\n`;
        formattedDisplay += `💡 **AVAILABLE ACTIONS:**\n`;
        formattedDisplay += `• View detailed patient profiles\n`;
        formattedDisplay += `• Filter by specific condition\n`;
        formattedDisplay += `• Export condition statistics\n`;
        formattedDisplay += `• Schedule preventive care campaigns\n`;
      }

      const fullResponse = {
        success: true,
        data: {
          patients: patientsWithConditions,
          summary: {
            totalPatients: patientsWithAnyCondition,
            totalUniqueConditions: totalUniqueConditions,
            totalConditionRecords: totalConditionRecords,
            patientsWithMultipleConditions: multiConditionPatients.length,
            averageConditionsPerPatient: patientsWithAnyCondition > 0
              ? (totalConditionRecords / patientsWithAnyCondition).toFixed(1)
              : 0
          },
          topConditions: topConditions,
          multiConditionPatients: multiConditionPatients,
          timeStatistics: timeStats,
          searchCriteria: {
            condition: condition || 'all',
            dateRange: dateRange
          }
        },
        message: detailedMessage,
        // Provide a pre-formatted display that should be shown as-is
        formattedResponse: formattedDisplay,
        displayAsIs: true  // Flag to indicate this should not be reformatted
      };

      return fullResponse;

    } catch (error) {
      console.error('Error getting condition statistics:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? 'שגיאה בחישוב סטטיסטיקות'
          : 'Error calculating statistics'
      };
    }
  }

async getPatientsList(params = {}, practiceContext, session) {
    // This function appears to be incomplete or delegates to another service
    // Placeholder implementation
    try {
      const context = this.createSecureContext(practiceContext, 'get_patients_list');
      const patients = await SecureDataAccess.query('patients', {}, { limit: params.limit || 100 }, context);
      return {
        success: true,
        data: patients,
        count: patients.length
      };
    } catch (error) {
      console.error('Error getting patients list:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

async addMedicalHistory(params, practiceContext, session) {
    try {
      // Extract patientId and nationalId separately to check context
      let { patientId, nationalId, ...historyData } = params;
      
      // Priority: Use nationalId if provided (more user-friendly)
      if (nationalId && !patientId) {
        // Search for patient by nationalId to get the MongoDB _id
        console.log(`🔍 Looking up patient by National ID for medical history: ${nationalId}`);
        const searchResult = await this.searchPatients({ 
          query: nationalId 
        }, practiceContext, session);
        
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          patientId = searchResult.data[0]._id;
          console.log(`✅ Found patient for medical history: ${searchResult.data[0].firstName} ${searchResult.data[0].lastName}`);
        } else {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצא מטופל עם תעודת זהות ${nationalId}` 
            : `No patient found with ID ${nationalId}`);
        }
      }
      
      // Check context if no patientId provided
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient: ${session.currentContext.patientName} (${patientId})`);
      }
      
      // Validate patient ID
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה מטופל. אנא חפש מטופל תחילה' 
          : 'Patient ID required. Please search for a patient first');
      }
      
      // Build security context for SecureDataAccess
      const context = AgentServiceHelpers.buildSecurityContext(
        'patientService',  // Use correct service name that matches registration
        this.serviceToken,
        practiceContext
      );
      
      // Ensure we have a valid date
      if (!historyData.date) {
        historyData.date = new Date();
      }
      
      // Set default category if not provided
      if (!historyData.category) {
        historyData.category = 'consultation_notes';
      }
      
      // Use the new medical data service to store in separate collections
      const serviceProxyManager = require('./serviceProxyManager');
      
      // Add patientId to the history data
      historyData.patientId = patientId;
      
      // Store in the appropriate collection based on category
      const result = await this.medicalDataService.storeMedicalData(
        historyData.category,
        historyData,
        context
      );
      
      if (!result) {
        throw new Error(practiceContext.language === 'he' 
          ? 'שגיאה בשמירת הרשומה הרפואית' 
          : 'Error saving medical history');
      }
      
      // Get patient info for success message
      const patients = await SecureDataAccess.query('patients', { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId }, {
        limit: 1,
        projection: {
          _id: 1,
          firstName: 1,
          lastName: 1
        }
      }, {
    ...context
  });
      const patient = patients[0];

      if (!patient) {
        throw new Error(practiceContext.language === 'he'
          ? 'מטופל לא נמצא'
          : 'Patient not found');
      }
      
      // Return the newly added entry
      const newEntry = result;
      
      return {
        success: true,
        data: newEntry,
        message: practiceContext.language === 'he' 
          ? `רשומה רפואית נוספה בהצלחה עבור ${patient.firstName} ${patient.lastName}`
          : `Medical history entry added successfully for ${patient.firstName} ${patient.lastName}`
      };
    } catch (error) {
      console.error('Error adding medical history:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בהוספת רשומה רפואית: ${error.message}`
          : `Error adding medical history: ${error.message}`
      };
    }
  }

async updateMedicalHistory(params, practiceContext, session) {
    try {
      // Extract parameters
      let { nationalId, entryId, ...updateData } = params;
      let patientId;
      
      // Look up patient by national ID
      if (nationalId) {
        console.log(`🔍 Looking up patient by National ID for update: ${nationalId}`);
        const searchResult = await this.searchPatients({ 
          query: nationalId 
        }, practiceContext, session);
        
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          patientId = searchResult.data[0]._id;
          console.log(`✅ Found patient for update: ${searchResult.data[0].firstName} ${searchResult.data[0].lastName}`);
        } else {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצא מטופל עם תעודת זהות ${nationalId}` 
            : `No patient found with National ID ${nationalId}`);
        }
      }
      
      // Check context if no patientId
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient for update: ${session.currentContext.patientName}`);
      }
      
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש תעודת זהות של המטופל' 
          : 'Patient national ID required');
      }
      
      if (!entryId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה הרשומה לעדכון' 
          : 'Entry ID required for update');
      }
      
      // Direct database access
      if (practiceContext.models?.Patient) {
        const Patient = practiceContext.models.Patient;
        const patient = await SecureDataAccess.query('patients', { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId }, { limit: 1 }, {
    ...context
  })[0];
        
        if (!patient) {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצא מטופל`
            : `Patient not found`);
        }
        
        // Find and update the specific history entry
        const entryIndex = patient.medicalHistory.findIndex(
          entry => entry._id.toString() === entryId
        );
        
        if (entryIndex === -1) {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצאה רשומה עם מזהה ${entryId}` 
            : `History entry not found with ID ${entryId}`);
        }
        
        // Update the entry
        const updatedEntry = {
          ...patient.medicalHistory[entryIndex].toObject(),
          ...updateData,
          lastModified: new Date(),
          modifiedBy: session?.userId || 'system'
        };
        
        patient.medicalHistory[entryIndex] = updatedEntry;
        await SecureDataAccess.update('patients', { _id: patient._id }, patient, {
    ...context
  });
        
        console.log(`✅ Updated medical history entry ${entryId} for patient ${patient.firstName} ${patient.lastName}`);
        
        return {
          success: true,
          data: updatedEntry,
          message: practiceContext.language === 'he' 
            ? `הרשומה עודכנה בהצלחה` 
            : `Medical history entry updated successfully`
        };
      }
      
      // No DB model available on this context — DB access required (the old
      // this.callAPI fallback referenced a microservice that no longer exists).
      return {
        success: false,
        error: 'Database access not available',
        message: practiceContext.language === 'he'
          ? 'גישת מסד נתונים לא זמינה'
          : 'Database access not available'
      };
      
    } catch (error) {
      console.error('Error updating medical history:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בעדכון רשומה: ${error.message}`
          : `Error updating entry: ${error.message}`
      };
    }
  }

async deleteMedicalHistory(params, practiceContext, session) {
    try {
      // Extract parameters
      let { nationalId, entryId, reason } = params;
      let patientId;
      
      // Look up patient by national ID
      if (nationalId) {
        console.log(`🔍 Looking up patient by National ID for deletion: ${nationalId}`);
        const searchResult = await this.searchPatients({ 
          query: nationalId 
        }, practiceContext, session);
        
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          patientId = searchResult.data[0]._id;
          console.log(`✅ Found patient for deletion: ${searchResult.data[0].firstName} ${searchResult.data[0].lastName}`);
        } else {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצא מטופל עם תעודת זהות ${nationalId}` 
            : `No patient found with National ID ${nationalId}`);
        }
      }
      
      // Check context if no patientId
      if (!patientId && session?.currentContext?.patientId) {
        patientId = session.currentContext.patientId;
        console.log(`🎯 Using context patient for deletion: ${session.currentContext.patientName}`);
      }
      
      if (!patientId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש תעודת זהות של המטופל' 
          : 'Patient national ID required');
      }
      
      if (!entryId) {
        throw new Error(practiceContext.language === 'he' 
          ? 'נדרש מזהה הרשומה למחיקה' 
          : 'Entry ID required for deletion');
      }
      
      // Direct database access
      if (practiceContext.models?.Patient) {
        const Patient = practiceContext.models.Patient;
        const patient = await SecureDataAccess.query('patients', { _id: typeof patientId === 'string' && patientId.match(/^[0-9a-fA-F]{24}$/) ? new ObjectId(patientId) : patientId }, { limit: 1 }, {
    ...context
  })[0];
        
        if (!patient) {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצא מטופל`
            : `Patient not found`);
        }
        
        // Find the entry to delete
        const entryIndex = patient.medicalHistory.findIndex(
          entry => entry._id.toString() === entryId
        );
        
        if (entryIndex === -1) {
          throw new Error(practiceContext.language === 'he' 
            ? `לא נמצאה רשומה עם מזהה ${entryId}` 
            : `History entry not found with ID ${entryId}`);
        }
        
        // Store the deleted entry for audit
        const deletedEntry = patient.medicalHistory[entryIndex];
        
        // Remove the entry
        patient.medicalHistory.splice(entryIndex, 1);
        await SecureDataAccess.update('patients', { _id: patient._id }, patient, {
    ...context
  });
        
        // Log deletion for audit
        console.log(`🗑️ Deleted medical history entry ${entryId} for patient ${patient.firstName} ${patient.lastName}`);
        if (reason) {
          console.log(`   Reason: ${reason}`);
        }
        
        // Store deletion in audit log using SecureDataAccess
        const context = AgentServiceHelpers.buildSecurityContext(
          'patientService',
          this.serviceToken,
          practiceContext
        );
        
        await AgentServiceHelpers.createAuditLog({
          action: 'DELETE_MEDICAL_HISTORY',
          userId: session?.userId || 'system',
          patientId: patientId,
          details: {
            entryId: entryId,
            deletedEntry: deletedEntry,
            reason: reason || 'No reason provided'
          },
          timestamp: new Date()
        }, context);
        
        return {
          success: true,
          message: practiceContext.language === 'he' 
            ? `הרשומה נמחקה בהצלחה` 
            : `Medical history entry deleted successfully`,
          deletedEntry: {
            id: entryId,
            date: deletedEntry.date,
            diagnosis: deletedEntry.diagnosis
          }
        };
      }
      
      // No DB model available on this context — DB access required (the old
      // this.callAPI fallback referenced a microservice that no longer exists).
      return {
        success: false,
        error: 'Database access not available',
        message: practiceContext.language === 'he'
          ? 'גישת מסד נתונים לא זמינה'
          : 'Database access not available'
      };
      
    } catch (error) {
      console.error('Error deleting medical history:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה במחיקת רשומה: ${error.message}`
          : `Error deleting entry: ${error.message}`
      };
    }
  }

async getPatientEngagementInsights(params, practiceContext, session) {
    try {
      const CommunicationAnalyticsService = require('./communicationAnalyticsService');
      const analyticsService = new CommunicationAnalyticsService();
      await analyticsService.initialize();
      
      // Get analytics with patient segmentation
      const analytics = await analyticsService.getCommunicationAnalytics({
        timeRange: params.timeRange || 30,
        segmentBy: params.patientSegment === 'all' ? 'overall' : 'demographic'
      }, practiceContext);

      if (analytics.success) {
        const insights = {
          engagementMetrics: analytics.analytics.engagementMetrics,
          timingAnalysis: analytics.analytics.timingAnalysis,
          channelPreferences: analytics.analytics.channelAnalysis.preferences,
          segmentedData: analytics.analytics.segmentedAnalysis,
          recommendations: analytics.analytics.recommendations.filter(r => 
            r.type === 'timing' || r.type === 'content'
          )
        };

        return {
          success: true,
          data: insights,
          message: session.language === 'he' 
            ? 'תובנות מעורבות מטופלים'
            : 'Patient engagement insights generated'
        };
      }

      return analytics;
    } catch (error) {
      console.error('Error getting patient engagement insights:', error);
      return {
        success: false,
        message: session.language === 'he' 
          ? 'שגיאה בקבלת תובנות מעורבות מטופלים'
          : 'Error getting patient engagement insights',
        error: error.message
      };
    }
  }

async anonymizePatientData(args, practiceContext, session) {
    const phiAnonymizationService = require('./phiAnonymizationService');

    // Create context for SecureDataAccess
    const context = this.createSecureContext(practiceContext, 'anonymizePatientData');

    // First try to find patient by ID or national ID
    let patient;
    if (args.patientId.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a MongoDB ObjectId - convert string to ObjectId
      const patientObjectId = new ObjectId(args.patientId);
      const patients = await SecureDataAccess.query('patients', { _id: patientObjectId }, {
        limit: 1,
        projection: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          nationalId: 1,
          socialSecurityNumber: 1,
          dateOfBirth: 1,
          email: 1,
          phone: 1
        }
      }, context);
      const patientDoc = patients[0];
      if (patientDoc) {
        patient = { data: [patientDoc.toObject()] };
      }
    } else {
      // Try searching by national ID or name
      patient = await this.searchPatients(
        { query: args.patientId },
        practiceContext,
        session
      );
    }
    
    if (!patient?.data?.[0]) {
      throw new Error('Patient not found');
    }
    
    return await phiAnonymizationService.anonymizeData(
      patient.data[0],
      {
        purpose: args.purpose || 'research',
        preserveFields: args.dataTypes || [],
        requestedBy: session?.userId || 'system',
        practiceId: practiceContext?.practiceId,
        practiceDb: practiceContext?.practiceDb
      }
    );
  }

async getPatientConsents(args, practiceContext, session) {
    const consentManagementService = require('./consentManagementService');
    return await consentManagementService.getPatientConsents(
      args.patientId,
      {
        activeOnly: args.activeOnly || false,
        practiceId: practiceContext?.practiceId,
        practiceDb: practiceContext?.practiceDb
      }
    );
  }

async assignDocumentToPatient(params, practiceContext, session) {
    try {
      const isHebrew = practiceContext.language === 'he';
      
      // Validate parameters
      if (!params.documentId && !params.uploadId) {
        return {
          success: false,
          message: isHebrew 
            ? 'נדרש מזהה מסמך או מזהה העלאה'
            : 'Document ID or upload ID is required'
        };
      }
      
      if (!params.patientId && !params.nationalId) {
        return {
          success: false,
          message: isHebrew 
            ? 'נדרש מזהה מטופל או תעודת זהות'
            : 'Patient ID or national ID is required'
        };
      }
      
      // Use analyzeDocument with the patient info
      const analysisParams = {
        documentId: params.documentId || params.uploadId,
        patientId: params.patientId,
        nationalId: params.nationalId,
        analysisType: params.analysisType || 'comprehensive'
      };
      
      const result = await this.analyzeDocument(analysisParams, practiceContext, session);
      
      if (result.success) {
        return {
          success: true,
          message: isHebrew 
            ? `המסמך שויך בהצלחה למטופל ונותח`
            : `Document successfully assigned to patient and analyzed`,
          data: result.data
        };
      }
      
      return result;
      
    } catch (error) {
      console.error('Error in assignDocumentToPatient:', error);
      return {
        success: false,
        message: practiceContext.language === 'he' 
          ? `שגיאה בשיוך מסמך למטופל: ${error.message}`
          : `Error assigning document to patient: ${error.message}`,
        error: error.message
      };
    }
  }

async checkPatientsForAllergies(params, practiceContext, session) {
    try {
      console.log('🔍 Checking patients for allergies');
      console.log('📋 practiceContext.user:', practiceContext.user);
      console.log('📋 practiceContext.user.roles:', practiceContext.user?.roles);
      console.log('📋 practiceContext.currentUser:', practiceContext.currentUser);
      console.log('📋 practiceContext.currentUser.roles:', practiceContext.currentUser?.roles);
      
      const context = {
        serviceId: this.serviceName,
        operation: 'check-patients-allergies',
        practiceId: practiceContext.subdomain || practiceContext.practiceSubdomain || (() => {
          console.error('❌ Practice subdomain missing in allergies check! practiceContext:', practiceContext);
          throw new Error('Practice context is required for allergy checks');
        })(),
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };
      
      // Build query
      const query = {};
      if (params.patientName) {
        // Search for specific patient
        const nameParts = params.patientName.split(' ');
        if (nameParts.length >= 2) {
          query.firstName = nameParts[0];
          query.lastName = nameParts.slice(1).join(' ');
        } else {
          query.$or = [
            { firstName: params.patientName },
            { lastName: params.patientName }
          ];
        }
      }
      
      // Get patients
      const patients = await SecureDataAccess.query(
        'patients',
        query,
        { limit: params.limit || 100 },
        context
      );
      
      // Filter patients with allergies
      const patientsWithAllergies = [];
      const patientsWithoutAllergies = [];
      
      patients.forEach(patient => {
        const patientAllergies = [];
        
        // Check allergies field
        if (patient.allergies && patient.allergies.length > 0) {
          patient.allergies.forEach(a => {
            const allergyName = typeof a === 'string' ? a : a.allergen || a.name || 'Unknown allergy';
            if (!patientAllergies.includes(allergyName)) {
              patientAllergies.push(allergyName);
            }
          });
        }
        
        // Check analyses for allergies
        if (patient.analyses && patient.analyses.length > 0) {
          patient.analyses.forEach(analysis => {
            if (analysis.allergies && analysis.allergies.length > 0) {
              analysis.allergies.forEach(a => {
                const allergyName = typeof a === 'string' ? a : a.allergen || a.name || 'Unknown allergy';
                if (!patientAllergies.includes(allergyName)) {
                  patientAllergies.push(allergyName + ' (from analysis)');
                }
              });
            }
            // Also check extractedData in analyses
            if (analysis.extractedData && analysis.extractedData.allergies) {
              analysis.extractedData.allergies.forEach(a => {
                const allergyName = typeof a === 'string' ? a : a.allergen || a.name || 'Unknown allergy';
                if (!patientAllergies.includes(allergyName)) {
                  patientAllergies.push(allergyName + ' (from analysis)');
                }
              });
            }
          });
        }
        
        // Check batchAnalysisHistory for allergies
        if (patient.batchAnalysisHistory && patient.batchAnalysisHistory.length > 0) {
          patient.batchAnalysisHistory.forEach(batch => {
            if (batch.extractedData && batch.extractedData.allergies && batch.extractedData.allergies.length > 0) {
              batch.extractedData.allergies.forEach(a => {
                const allergyName = typeof a === 'string' ? a : a.allergen || a.name || 'Unknown allergy';
                if (!patientAllergies.includes(allergyName)) {
                  patientAllergies.push(allergyName + ' (from batch analysis)');
                }
              });
            }
          });
        }
        
        // Check medicalHistory for allergy information
        if (patient.medicalHistory && patient.medicalHistory.length > 0) {
          patient.medicalHistory.forEach(entry => {
            if (entry.extractedData && entry.extractedData.allergies && entry.extractedData.allergies.length > 0) {
              entry.extractedData.allergies.forEach(a => {
                const allergyName = typeof a === 'string' ? a : a.allergen || a.name || 'Unknown allergy';
                if (!patientAllergies.includes(allergyName)) {
                  patientAllergies.push(allergyName + ' (from medical history)');
                }
              });
            }
            // Also check if allergies are mentioned in notes
            if (entry.notes && typeof entry.notes === 'string') {
              const allergyMatches = entry.notes.match(/allergic to (\w+)/gi) || 
                                    entry.notes.match(/allergy: (\w+)/gi) ||
                                    entry.notes.match(/allergies: ([^,\n]+)/gi);
              if (allergyMatches) {
                allergyMatches.forEach(match => {
                  const allergyName = match.replace(/allergic to |allergy: |allergies: /gi, '').trim();
                  if (allergyName && !patientAllergies.includes(allergyName)) {
                    patientAllergies.push(allergyName + ' (from notes)');
                  }
                });
              }
            }
          });
        }
        
        if (patientAllergies.length > 0) {
          patientsWithAllergies.push({
            name: `${patient.firstName} ${patient.lastName}`,
            allergies: patientAllergies
          });
        } else {
          patientsWithoutAllergies.push({
            name: `${patient.firstName} ${patient.lastName}`
          });
        }
      });
      
      // Build response message
      let message = '';
      if (patientsWithAllergies.length > 0) {
        message = practiceContext.language === 'he'
          ? `נמצאו ${patientsWithAllergies.length} מטופלים עם אלרגיות:\n`
          : `Found ${patientsWithAllergies.length} patient(s) with allergies:\n`;
        
        patientsWithAllergies.forEach(p => {
          message += `\n• ${p.name}:\n`;
          p.allergies.forEach(a => {
            message += `  - ${a}\n`;
          });
        });
      } else {
        message = practiceContext.language === 'he'
          ? 'לא נמצאו מטופלים עם אלרגיות רשומות במערכת'
          : 'No patients found with recorded allergies in the system';
      }
      
      if (patientsWithoutAllergies.length > 0 && params.patientName) {
        message += practiceContext.language === 'he'
          ? `\n\n${patientsWithoutAllergies.length} מטופלים ללא אלרגיות רשומות`
          : `\n\n${patientsWithoutAllergies.length} patient(s) without recorded allergies`;
      }
      
      return {
        success: true,
        data: {
          patientsWithAllergies,
          patientsWithoutAllergies: patientsWithoutAllergies.length,
          totalChecked: patients.length
        },
        message,
        displayInCard: true
      };
      
    } catch (error) {
      console.error('Error checking patients for allergies:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בבדיקת אלרגיות: ${error.message}`
          : `Error checking allergies: ${error.message}`
      };
    }
  }

  /**
   * Fuzzy patient search using Claude Sonnet 4.5 for typo correction
   * When exact search fails, Claude analyzes the query and finds best matches
   * @param {string} searchQuery - User's search query (potentially with typos)
   * @param {Object} practiceContext - Practice context
   * @param {Object} securityContext - Security context for database access
   * @returns {Promise<Array>} - Array of matching patients
   */
  async fuzzyPatientSearch(searchQuery, practiceContext, securityContext) {
    try {
      // Get all patients (with minimal projection for performance)
      const allPatients = await SecureDataAccess.query(
        'patients',
        {},
        {
          projection: {
            firstName: 1,
            lastName: 1,
            name: 1,
            dateOfBirth: 1,
            phone: 1,
            email: 1,
            nationalId: 1,
            ssn: 1
          },
          limit: 500  // Reasonable limit to avoid overwhelming Claude
        },
        securityContext
      );

      if (!allPatients || allPatients.length === 0) {
        return [];
      }

      // Build patient name list for Claude
      const patientList = allPatients.map((p, idx) => {
        const fullName = p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim();
        return `${idx + 1}. ${fullName}`;
      }).join('\n');

      // Use Claude Sonnet 4.5 to find best matches
      const Anthropic = require('@anthropic-ai/sdk');
      const productionKMS = require('./productionKMS');
      const apiKey = await productionKMS.getInternalKey('ANTHROPIC_API_KEY') || await productionKMS.getInternalKey('CLAUDE_API_KEY');

      const anthropic = new Anthropic({ apiKey });

      const prompt = `You are a medical receptionist with perfect name matching ability. A doctor is searching for a patient.

SEARCH QUERY: "${searchQuery}"

This search may have typos, misspellings, missing letters, or extra letters. Your job is to find the best matching patient(s) from the list below.

PATIENT LIST:
${patientList}

MATCHING RULES:
1. Look for names that sound similar (phonetic matching)
2. Account for common typos:
   - Missing letters: "Heln Cox" → "Helen Cox"
   - Extra letters: "Hellen Cox" → "Helen Cox"
   - Wrong letters: "Halan Cox" → "Helen Cox"
   - Transposed letters: "Hlene Cox" → "Helen Cox"
   - Keyboard adjacent keys: "Hwlen Cox" → "Helen Cox"
3. Consider both first name and last name separately
4. Be generous with matching - if it's reasonably close, include it
5. Match partial names if the search is incomplete

EXAMPLES OF GOOD MATCHES:
- Search "Heln Cox" → Match "Helen Cox" (missing 'e')
- Search "Hellen Cox" → Match "Helen Cox" (extra 'l')
- Search "Richrd Philips" → Match "Richard Phillips" (missing 'a' and wrong last name)
- Search "Jon Smith" → Match "John Smith" (missing 'h')
- Search "Halan" → Match "Helen Cox" (partial name with typo)
- Search "Cox" → Match "Helen Cox" (last name only)

YOUR RESPONSE:
Return ONLY the line numbers (comma-separated) of matching patients.
If absolutely no reasonable match exists (completely different name), return "NONE".
Maximum 5 best matches.

Line numbers:`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 150,  // Allow for multiple matches and reasoning
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const claudeResponse = response.content[0].text.trim();
      console.log('🤖 Claude fuzzy match response:', claudeResponse);

      if (claudeResponse === 'NONE' || !claudeResponse || claudeResponse.toUpperCase().includes('NONE')) {
        console.log('🤖 Claude found no matches');
        return [];
      }

      // Parse Claude's response to get patient indices
      // Extract all numbers from the response (handles various formats)
      const numberMatches = claudeResponse.match(/\d+/g);
      if (!numberMatches) {
        console.log('❌ No numbers found in Claude response');
        return [];
      }

      const indices = numberMatches
        .map(n => parseInt(n) - 1)  // Convert to 0-based index
        .filter(n => !isNaN(n) && n >= 0 && n < allPatients.length);

      console.log(`🤖 Claude matched indices: ${indices.map(i => i + 1).join(', ')}`);
      console.log(`🤖 Matched patient names: ${indices.map(i => allPatients[i].name || `${allPatients[i].firstName} ${allPatients[i].lastName}`).join(', ')}`);

      if (indices.length === 0) {
        return [];
      }

      // Get full patient records for matched indices
      const matchedPatientIds = indices.map(idx => allPatients[idx]._id);
      const fullPatients = await SecureDataAccess.query(
        'patients',
        { _id: { $in: matchedPatientIds } },
        {},
        securityContext
      );

      console.log(`✅ Claude matched ${fullPatients.length} patient(s) for typo-corrected query "${searchQuery}"`);
      return fullPatients;

    } catch (error) {
      console.error('❌ Error in fuzzy patient search:', error);
      // Fail gracefully - return empty array instead of throwing
      return [];
    }
  }

  /**
   * Generate common typo variations for fuzzy search
   *
   * @param {string} query - Original search query
   * @returns {Array<string>} - Array of possible variations
   *
   * Handles:
   * - Double/single letter variations (Ellison → Elison, Philip → Phillip)
   * - Missing letters (Dvid → David)
   * - Extra letters (Davvid → David)
   * - Transposed adjacent letters (Devid → David)
   * - Common name variations (David → Dave, Michael → Mike)
   */
  generateTypoVariations(query) {
    if (!query || typeof query !== 'string') return [];

    const variations = new Set();
    const normalized = query.trim().toLowerCase();

    // Add original
    variations.add(query.trim());

    // Handle full name vs single name
    const words = normalized.split(/\s+/);

    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
      const word = words[wordIndex];

      // 1. Double/single letter variations
      for (let i = 0; i < word.length - 1; i++) {
        if (word[i] === word[i + 1]) {
          // Remove double letter: "Ellison" → "Elison"
          const variant = word.substring(0, i) + word.substring(i + 1);
          const newWords = [...words];
          newWords[wordIndex] = variant;
          variations.add(newWords.join(' '));
        } else {
          // Add double letter: "Elison" → "Ellison"
          const variant = word.substring(0, i + 1) + word[i] + word.substring(i + 1);
          const newWords = [...words];
          newWords[wordIndex] = variant;
          variations.add(newWords.join(' '));
        }
      }

      // 2. Missing letter variations (try adding common letters)
      const commonInsertions = ['a', 'e', 'i', 'o', 'u', 'r', 'l', 'n', 's', 't'];
      for (let i = 0; i <= word.length; i++) {
        for (const letter of commonInsertions) {
          const variant = word.substring(0, i) + letter + word.substring(i);
          const newWords = [...words];
          newWords[wordIndex] = variant;
          variations.add(newWords.join(' '));
        }
      }

      // 3. Extra letter variations (try removing each letter)
      for (let i = 0; i < word.length; i++) {
        const variant = word.substring(0, i) + word.substring(i + 1);
        const newWords = [...words];
        newWords[wordIndex] = variant;
        variations.add(newWords.join(' '));
      }

      // 4. Transposed adjacent letters
      for (let i = 0; i < word.length - 1; i++) {
        const chars = word.split('');
        [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
        const variant = chars.join('');
        const newWords = [...words];
        newWords[wordIndex] = variant;
        variations.add(newWords.join(' '));
      }
    }

    // 5. Common name variations (only for first names)
    const commonNameVariations = {
      'david': ['dave', 'davey', 'davie'],
      'dave': ['david'],
      'michael': ['mike', 'mick', 'mikey'],
      'mike': ['michael'],
      'robert': ['rob', 'bob', 'bobby', 'robbie'],
      'rob': ['robert', 'robbie'],
      'bob': ['robert', 'bobby'],
      'richard': ['rick', 'dick', 'rich', 'ricky'],
      'rick': ['richard', 'ricky'],
      'william': ['will', 'bill', 'billy', 'willie'],
      'will': ['william'],
      'bill': ['william', 'billy'],
      'james': ['jim', 'jimmy', 'jamie'],
      'jim': ['james', 'jimmy'],
      'john': ['johnny', 'jack'],
      'johnny': ['john'],
      'thomas': ['tom', 'tommy'],
      'tom': ['thomas', 'tommy'],
      'charles': ['charlie', 'chuck'],
      'charlie': ['charles'],
      'joseph': ['joe', 'joey'],
      'joe': ['joseph', 'joey'],
      'anthony': ['tony'],
      'tony': ['anthony'],
      'christopher': ['chris'],
      'chris': ['christopher'],
      'daniel': ['dan', 'danny'],
      'dan': ['daniel', 'danny'],
      'matthew': ['matt', 'matty'],
      'matt': ['matthew'],
      'elizabeth': ['liz', 'beth', 'betty', 'lizzie'],
      'liz': ['elizabeth', 'lizzie'],
      'beth': ['elizabeth'],
      'jennifer': ['jen', 'jenny'],
      'jen': ['jennifer', 'jenny'],
      'catherine': ['cathy', 'kate', 'katie'],
      'cathy': ['catherine'],
      'kate': ['catherine', 'katie'],
      'margaret': ['maggie', 'meg', 'peggy'],
      'maggie': ['margaret'],
      'patricia': ['pat', 'patty', 'trish'],
      'pat': ['patricia', 'patty']
    };

    // Apply name variations to first word (first name)
    if (words.length > 0) {
      const firstName = words[0];
      if (commonNameVariations[firstName]) {
        for (const variant of commonNameVariations[firstName]) {
          const newWords = [variant, ...words.slice(1)];
          variations.add(newWords.join(' '));
        }
      }
    }

    // Convert to array and filter out very short variations (< 2 chars)
    const result = Array.from(variations).filter(v => v.length >= 2);

    // Limit to reasonable number (avoid too many DB queries)
    return result.slice(0, 30);
  }

}

module.exports = new PatientService();
