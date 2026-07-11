/**
 * ClinicService
 *
 * Domain: clinic
 * Extracted from: agentServiceV4.js
 * Functions: 18
 *
 * Purpose: Handle all clinic-related operations including settings, statistics, and clinical guidelines
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

class ClinicService {
  constructor() {
    this.serviceName = 'clinicService';
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

async getClinicInfo(params, practiceContext) {
    const { includeStats = false, includeFinancial = false } = params || {};
    
    // Check if user has admin or manager role
    const userRoles = practiceContext.currentUser?.roles || practiceContext.user?.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('systemAdmin');
    const isManager = userRoles.includes('manager') || userRoles.includes('clinicManager');
    
    if (!isAdmin && !isManager) {
      return {
        success: false,
        error: practiceContext.language === 'he'
          ? 'רק מנהלים ומנהלי מערכת יכולים לצפות בפרטי המרפאה'
          : 'Only administrators and managers can view practice information'
      };
    }
    
    try {
      // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess
      const getClinicInfoContext = {
        serviceId: this.serviceName,
        operation: 'get_clinic_info',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Get practice info from database
      const practices = await SecureDataAccess.query(
        'practices',
        { subdomain: practiceContext?.subdomain || practiceContext?.practiceId },
        {},
        getClinicInfoContext
      );

      if (!practices || practices.length === 0) {
        return {
          success: false,
          error: practiceContext.language === 'he'
            ? 'מרפאה לא נמצאה'
            : 'Practice not found'
        };
      }

      let data = practices[0];

      // Filter sensitive data for non-admin users
      if (!isAdmin && data) {
        // Remove sensitive financial information for managers
        const filteredData = { ...data };
        delete filteredData.billing;
        delete filteredData.revenue;
        delete filteredData.costs;
        delete filteredData.apiKeys;
        data = filteredData;
      }

      return {
        success: true,
        data: data,
        userRole: isAdmin ? 'administrator' : 'manager',
        message: practiceContext.language === 'he'
          ? `פרטי המרפאה נטענו בהצלחה`
          : `Practice information loaded successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to retrieve practice information'
      };
    }
  }

async updateClinicSettings(params, practiceContext) {
    // Check if user has admin role
    const userRoles = practiceContext.currentUser?.roles || practiceContext.user?.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('systemAdmin');
    
    if (!isAdmin) {
      return {
        success: false,
        error: practiceContext.language === 'he'
          ? 'רק מנהלי מערכת יכולים לעדכן הגדרות מרפאה'
          : 'Only system administrators can update practice settings'
      };
    }
    
    try {
      const response = await this.callAPI(`/practices/settings`, 'PUT', params, practiceContext);
      
      return {
        success: true,
        data: response.data,
        message: practiceContext.language === 'he' 
          ? `הגדרות המרפאה עודכנו בהצלחה`
          : `Practice settings updated successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to update practice settings'
      };
    }
  }

async discoverPractice(params, practiceContext, session) {
    const { practiceName, location = null, createRecord = true } = params || {};
    const isHebrew = practiceContext.language === 'he';

    try {
      console.log(`🔍 Discovering practice: "${practiceName}"${location ? ` in ${location}` : ''}`);

      // First check if practice already exists in database
      const context = {
        serviceId: this.serviceName,
        operation: 'check-existing-practice',
        practiceId: 'global',
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      const existingPractice = await SecureDataAccess.query('practices', {
        name: { $regex: practiceName, $options: 'i' }
      }, { limit: 1 }, context);

      if (existingPractice && existingPractice.length > 0) {
        console.log('✅ Practice already exists in database');
        return {
          success: true,
          exists: true,
          data: existingPractice[0]
        };
      }

      // Use Claude to discover practice details
      const prompt = `Find comprehensive information about this medical practice/hospital:
      Name: "${practiceName}"
      ${location ? `Location/Region: ${location}` : ''}

      Please provide ALL available information:
      1. Official full name
      2. Complete street address
      3. City, state/region, postal code
      4. Country
      5. Main phone number
      6. Website URL
      7. Email contact
      8. Type of facility (hospital/practice/medical center/urgent care)
      9. Specialties or departments
      10. Operating hours (be specific for each day)
      11. Emergency services (yes/no)
      12. Number of beds (if hospital)
      13. Founded year
      14. Parent organization (if any)

      If not in your knowledge, search the web or indicate what's missing.

      Return as JSON matching this exact structure:
      {
        "found": true/false,
        "name": "official full name",
        "subdomain": "suggested-subdomain-for-url",
        "status": "active",
        "contact": {
          "address": {
            "street": "street and number",
            "city": "city name",
            "state": "state or region",
            "country": "country name",
            "postalCode": "postal/zip code"
          },
          "phone": "main phone with country code",
          "email": "contact email if known",
          "website": "official website URL"
        },
        "settings": {
          "workingHours": {
            "start": "08:00",
            "end": "18:00",
            "days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
            "googlePlacesHours": {
              "weekdayDescriptions": ["Monday: 8:00 AM - 6:00 PM"],
              "openNow": true
            }
          },
          "timezone": "America/New_York or Asia/Jerusalem",
          "language": "en or he",
          "dateFormat": "MM/DD/YYYY or DD/MM/YYYY",
          "currency": "USD or ILS",
          "patientIdFormat": "us_ssn or il_id"
        },
        "type": "hospital/practice/medical_center/urgent_care",
        "specialties": ["cardiology", "oncology"],
        "hasEmergency": true,
        "bedCount": 500,
        "foundedYear": 1970,
        "parentOrganization": "parent org name or null",
        "confidence": "high/medium/low",
        "source": "knowledge/web/inference"
      }`;

      // Call Claude with explicit JSON instructions
      const claudeService = require('./agentServiceClaude');
      await claudeService.initialize();

      const response = await claudeService.anthropic.messages.create({
        model: 'claude-sonnet-5',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system: 'You are a JSON-only responder. You must ALWAYS return valid JSON and nothing else. Never include explanations or text outside the JSON structure.',
        messages: [{ role: 'user', content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON, no explanations or additional text.' }],
        max_tokens: 20000
      });

      // Clean the response - Claude might wrap JSON in markdown code blocks
      let responseText = response.content[0].text;
      responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

      // Additional cleaning - remove any text before the first { and after the last }
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        responseText = responseText.substring(firstBrace, lastBrace + 1);
      }

      let practiceData;
      try {
        practiceData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse Claude response as JSON:', responseText);
        console.error('Parse error:', parseError.message);

        // Return error to user
        return {
          success: false,
          message: isHebrew
            ? `לא הצלחתי לחפש מידע על "${practiceName}". אנא נסה שוב.`
            : `Failed to search for information about "${practiceName}". Please try again.`,
          error: 'Invalid response format from AI service'
        };
      }

      if (!practiceData.found) {
        return {
          success: false,
          message: isHebrew
            ? `לא מצאתי מידע על "${practiceName}"`
            : `Could not find information about "${practiceName}"`
        };
      }

      // Generate subdomain if not provided
      if (!practiceData.subdomain) {
        practiceData.subdomain = practiceName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .substring(0, 50);
      }

      // Set subscription defaults for new practice
      practiceData.subscription = {
        plan: 'professional',
        maxUsers: 50,
        maxPatients: 1000,
        features: ['ai_analysis', 'document_upload', 'multi_user', 'api_access'],
        isActive: true,
        billingCycle: 'monthly',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      // Add audit fields
      practiceData.createdAt = new Date();
      practiceData.updatedAt = new Date();
      practiceData.isDeleted = false;

      // Store in database if requested
      if (createRecord) {
        const insertedPractice = await SecureDataAccess.insert('practices', practiceData, {
          serviceId: this.serviceName,
          operation: 'create-discovered-practice',
          practiceId: 'global'
        });

        console.log(`✅ Practice "${practiceData.name}" created in database`);

        return {
          success: true,
          created: true,
          data: insertedPractice,
          message: isHebrew
            ? `המרפאה "${practiceData.name}" נוצרה בהצלחה`
            : `Practice "${practiceData.name}" created successfully`
        };
      }

      return {
        success: true,
        created: false,
        data: practiceData
      };

    } catch (error) {
      console.error('❌ Error discovering practice:', error);
      return {
        success: false,
        error: error.message,
        message: isHebrew
          ? 'שגיאה בגילוי פרטי המרפאה'
          : 'Error discovering practice details'
      };
    }
  }

async getClinicStatistics(params, practiceContext) {
    // Computed via SecureDataAccess - this service has no callAPI (removed in the
    // SecureDataAccess refactor; the old this.callAPI('/practices/statistics') crashed)
    const { period } = params;
    const context = this.createSecureContext(practiceContext, 'getClinicStatistics');

    const now = new Date();
    const [totalPatients, totalAppointments, upcomingAppointments, totalProviders, totalPrescriptions] = await Promise.all([
      SecureDataAccess.query('patients', {}, { count: true }, context),
      SecureDataAccess.query('appointments', {}, { count: true }, context),
      SecureDataAccess.query('appointments', { date: { $gte: now } }, { count: true }, context),
      SecureDataAccess.query('providers', {}, { count: true }, context),
      SecureDataAccess.query('prescriptions', {}, { count: true }, context)
    ]);

    const statistics = { totalPatients, totalAppointments, upcomingAppointments, totalProviders, totalPrescriptions };

    return {
      success: true,
      data: statistics,
      statistics: statistics,
      message: practiceContext.language === 'he'
        ? `סטטיסטיקות ${period || 'המרפאה'} נטענו בהצלחה`
        : `${period || 'Practice'} statistics loaded successfully`
    };
  }

async generateClinicReport(params, practiceContext) {
    // INFRASTRUCTURE: Complex report generation service - Keep as callAPI
    const response = await this.callAPI('/reports/practice', 'POST', params, practiceContext);
    return {
      success: true,
      data: response.data,
      reportUrl: response.data.url
    };
  }

async getClinicAddress(params, practiceContext) {
    const { practiceName, searchQuery, includeAllClinics = false } = params || {};
    const isHebrew = practiceContext.language === 'he';
    
    try {
      // If searching for a specific practice by name
      if (searchQuery || practiceName) {
        const googlePlacesService = require('./googlePlacesService');
        await googlePlacesService.initialize();
        
        // Search using Google Places API
        const searchTerm = practiceName || searchQuery;
        const results = await googlePlacesService.searchPlaces(searchTerm, 'practice');
        
        if (results && results.length > 0) {
          // Format results for display
          const formattedResults = results.map(place => ({
            name: place.name,
            address: place.formatted_address,
            street: place.street || place.route,
            city: place.city || place.locality,
            state: place.state || place.administrative_area_level_1,
            zipCode: place.postal_code,
            country: place.country,
            placeId: place.place_id,
            location: place.geometry?.location
          }));
          
          return {
            success: true,
            addresses: formattedResults,
            count: formattedResults.length,
            message: isHebrew 
              ? `נמצאו ${formattedResults.length} כתובות`
              : `Found ${formattedResults.length} addresses`
          };
        }
      }
      
      // Get current practice's address
      const context = {
        serviceId: this.serviceName,
        operation: 'get-practice-address',
        practiceId: practiceContext.practiceId || practiceContext.id,
        practiceSubdomain: practiceContext.practiceSubdomain,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken?.sessionToken || this.serviceToken
      };
      
      // Get practice data from database
      const practices = await SecureDataAccess.query('practices', 
        includeAllClinics ? {} : { _id: practiceContext.id || practiceContext.practiceId },
        { limit: includeAllClinics ? 100 : 1 },
        context
      );
      
      if (!practices || practices.length === 0) {
        return {
          success: false,
          error: isHebrew ? 'לא נמצאו פרטי מרפאה' : 'No practice information found'
        };
      }
      
      // Format practice addresses
      const addresses = practices.map(practice => ({
        practiceName: practice.name,
        practiceId: practice._id,
        address: {
          street: practice.address?.street || '',
          city: practice.address?.city || '',
          state: practice.address?.state || '',
          zipCode: practice.address?.zipCode || '',
          country: practice.address?.country || 'Israel',
          formatted: `${practice.address?.street || ''}, ${practice.address?.city || ''} ${practice.address?.zipCode || ''}, ${practice.address?.country || 'Israel'}`.trim()
        },
        contact: {
          phone: practice.phone,
          email: practice.email,
          website: practice.website
        },
        googlePlaceId: practice.googlePlaceId || null
      }));
      
      return {
        success: true,
        addresses: addresses,
        count: addresses.length,
        message: isHebrew 
          ? `${addresses.length === 1 ? 'כתובת המרפאה' : `נמצאו ${addresses.length} מרפאות`}`
          : `${addresses.length === 1 ? 'Practice address' : `Found ${addresses.length} practices`}`
      };
      
    } catch (error) {
      console.error('Error getting practice address:', error);
      return {
        success: false,
        error: isHebrew 
          ? 'שגיאה בקבלת כתובת המרפאה'
          : 'Error getting practice address',
        details: error.message
      };
    }
  }

}

module.exports = new ClinicService();
