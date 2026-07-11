/**
 * ProviderService
 *
 * Domain: provider
 * Extracted from: agentServiceV4.js
 * Functions: 16
 *
 * Purpose: Handle all provider-related operations including licensing and directory management
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
const roleModel = require('../config/roles');

class ProviderService {
  constructor() {
    this.serviceName = 'providerService';
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

async addDoctorLicense(params, practiceContext, session) {
    console.log('➕ Starting addDoctorLicense:', { params, practiceContext });

    try {
      // Extract user ID from params
      let userId = params.userId || params.userEmail || params.email;

      // Handle 'me' case - use current user from session
      if (userId === 'me') {
        if (!session?.user?.email && !session?.user?._id) {
          return {
            success: false,
            message: practiceContext.language === 'he'
              ? 'לא נמצא משתמש נוכחי בהפעלה'
              : 'No current user found in session'
          };
        }
        userId = session.user.email || session.user._id;
      }

      if (!userId) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'נדרש מזהה משתמש או אימייל'
            : 'User ID or email is required'
        };
      }

      if (!params.licenseNumber) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'נדרש מספר רישיון'
            : 'License number is required'
        };
      }

      // Find user
      const usersCollection = practiceContext.isGlobalPractice ? 'Users' : 'users';
      const userFilter = userId.includes('@') ? { email: userId } : { _id: userId };

      const users = await SecureDataAccess.query(
        usersCollection,
        userFilter,
        {},
        {
          serviceId: this.serviceName,
          operation: 'addDoctorLicense',
          practiceId: practiceContext.practiceId || 'global'
        }
      );

      if (!users || users.length === 0) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'משתמש לא נמצא'
            : 'User not found'
        };
      }

      const user = users[0];

      // Check if user is a provider (clinical role: doctor/nurse, or already has provider setup)
      const isProvider = roleModel.rolesAreClinical(user.roles) || !!user.providerInfo?.providerId;
      if (!isProvider) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? `המשתמש ${user.profile?.firstName || user.email} אינו ספק שירות. יש להוסיף תפקיד קליני (רופא/אחות) תחילה`
            : `User ${user.profile?.firstName || user.email} is not a provider. Please assign a clinical role (doctor/nurse) first`
        };
      }

      // Prepare license update data
      const licenseUpdate = {
        'providerInfo.licenseNumber': params.licenseNumber
      };

      if (params.licenseState) {
        licenseUpdate['providerInfo.licenseState'] = params.licenseState;
      }

      if (params.licenseExpiry) {
        licenseUpdate['providerInfo.licenseExpiry'] = new Date(params.licenseExpiry);
      }

      // Update license information
      const updateResult = await SecureDataAccess.update(
        usersCollection,
        userFilter,
        { $set: licenseUpdate },
        {
          serviceId: this.serviceName,
          operation: 'addDoctorLicense',
          practiceId: practiceContext.practiceId || 'global'
        }
      );

      if (!updateResult) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'שגיאה בהוספת רישיון'
            : 'Failed to add license'
        };
      }

      // Build success message
      let message = practiceContext.language === 'he'
        ? `✅ רישיון רפואי נוסף בהצלחה עבור ${user.profile?.firstName || user.email}\n📋 מספר רישיון: ${params.licenseNumber}`
        : `✅ Medical license added successfully for ${user.profile?.firstName || user.email}\n📋 License number: ${params.licenseNumber}`;

      if (params.licenseState) {
        message += practiceContext.language === 'he'
          ? `\n📍 מדינה/אזור: ${params.licenseState}`
          : `\n📍 State/Region: ${params.licenseState}`;
      }

      if (params.licenseExpiry) {
        message += practiceContext.language === 'he'
          ? `\n📅 תאריך תפוגה: ${new Date(params.licenseExpiry).toLocaleDateString('he-IL')}`
          : `\n📅 Expiry date: ${new Date(params.licenseExpiry).toLocaleDateString('en-US')}`;
      }

      return {
        success: true,
        message: message,
        userId: user._id?.toString() || user.email,
        licenseData: {
          licenseNumber: params.licenseNumber,
          licenseState: params.licenseState,
          licenseExpiry: params.licenseExpiry
        }
      };

    } catch (error) {
      console.error('Error adding provider license:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהוספת רישיון: ${error.message}`
          : `Error adding license: ${error.message}`
      };
    }
  }

async updateDoctorLicense(params, practiceContext, session) {
    console.log('📝 Starting updateDoctorLicense:', { params, practiceContext });

    try {
      // Extract user ID from params
      let userId = params.userId || params.userEmail || params.email;

      // Handle 'me' case - use current user from session
      if (userId === 'me') {
        if (!session?.user?.email && !session?.user?._id) {
          return {
            success: false,
            message: practiceContext.language === 'he'
              ? 'לא נמצא משתמש נוכחי בהפעלה'
              : 'No current user found in session'
          };
        }
        userId = session.user.email || session.user._id;
      }

      if (!userId) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'נדרש מזהה משתמש או אימייל'
            : 'User ID or email is required'
        };
      }

      if (!params.licenseNumber) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'נדרש מספר רישיון'
            : 'License number is required'
        };
      }

      // Find user
      const usersCollection = practiceContext.isGlobalPractice ? 'Users' : 'users';
      const userFilter = userId.includes('@') ? { email: userId } : { _id: userId };

      const users = await SecureDataAccess.query(
        usersCollection,
        userFilter,
        {},
        {
          serviceId: this.serviceName,
          operation: 'updateDoctorLicense',
          practiceId: practiceContext.practiceId || 'global'
        }
      );

      if (!users || users.length === 0) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'משתמש לא נמצא'
            : 'User not found'
        };
      }

      const user = users[0];

      // Check if user is a provider (clinical role: doctor/nurse, or already has provider setup)
      const isProvider = roleModel.rolesAreClinical(user.roles) || !!user.providerInfo?.providerId;
      if (!isProvider) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? `המשתמש ${user.profile?.firstName || user.email} אינו ספק שירות. יש להוסיף תפקיד קליני (רופא/אחות) תחילה`
            : `User ${user.profile?.firstName || user.email} is not a provider. Please assign a clinical role (doctor/nurse) first`
        };
      }

      // Prepare license update data
      const licenseUpdate = {
        'providerInfo.licenseNumber': params.licenseNumber
      };

      if (params.licenseState) {
        licenseUpdate['providerInfo.licenseState'] = params.licenseState;
      }

      if (params.licenseExpiry) {
        licenseUpdate['providerInfo.licenseExpiry'] = new Date(params.licenseExpiry);
      }

      // Update license information
      const updateResult = await SecureDataAccess.update(
        usersCollection,
        userFilter,
        { $set: licenseUpdate },
        {
          serviceId: this.serviceName,
          operation: 'updateDoctorLicense',
          practiceId: practiceContext.practiceId || 'global'
        }
      );

      if (!updateResult) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'שגיאה בעדכון רישיון'
            : 'Failed to update license'
        };
      }

      // Build success message
      let message = practiceContext.language === 'he'
        ? `✅ רישיון רפואי עודכן בהצלחה עבור ${user.profile?.firstName || user.email}\n📋 מספר רישיון: ${params.licenseNumber}`
        : `✅ Medical license updated successfully for ${user.profile?.firstName || user.email}\n📋 License number: ${params.licenseNumber}`;

      if (params.licenseState) {
        message += practiceContext.language === 'he'
          ? `\n📍 מדינה/אזור: ${params.licenseState}`
          : `\n📍 State/Region: ${params.licenseState}`;
      }

      if (params.licenseExpiry) {
        message += practiceContext.language === 'he'
          ? `\n📅 תאריך תפוגה: ${new Date(params.licenseExpiry).toLocaleDateString('he-IL')}`
          : `\n📅 Expiry date: ${new Date(params.licenseExpiry).toLocaleDateString('en-US')}`;
      }

      return {
        success: true,
        message: message,
        userId: user._id?.toString() || user.email,
        licenseData: {
          licenseNumber: params.licenseNumber,
          licenseState: params.licenseState,
          licenseExpiry: params.licenseExpiry
        }
      };

    } catch (error) {
      console.error('Error updating provider license:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בעדכון רישיון: ${error.message}`
          : `Error updating license: ${error.message}`
      };
    }
  }

async removeDoctorLicense(params, practiceContext, session) {
    console.log('🗑️ Starting removeDoctorLicense:', { params, practiceContext });

    try {
      // Extract user ID from params
      let userId = params.userId || params.userEmail || params.email;

      // Handle 'me' case - use current user from session
      if (userId === 'me') {
        if (!session?.user?.email && !session?.user?._id) {
          return {
            success: false,
            message: practiceContext.language === 'he'
              ? 'לא נמצא משתמש נוכחי בהפעלה'
              : 'No current user found in session'
          };
        }
        userId = session.user.email || session.user._id;
      }

      if (!userId) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'נדרש מזהה משתמש או אימייל'
            : 'User ID or email is required'
        };
      }

      // Find user
      const usersCollection = practiceContext.isGlobalPractice ? 'Users' : 'users';
      const userFilter = userId.includes('@') ? { email: userId } : { _id: userId };

      const users = await SecureDataAccess.query(
        usersCollection,
        userFilter,
        {},
        {
          serviceId: this.serviceName,
          operation: 'removeDoctorLicense',
          practiceId: practiceContext.practiceId || 'global'
        }
      );

      if (!users || users.length === 0) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'משתמש לא נמצא'
            : 'User not found'
        };
      }

      const user = users[0];

      // Check if user has license to remove
      if (!user.providerInfo?.licenseNumber) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? `למשתמש ${user.profile?.firstName || user.email} אין רישיון רפואי רשום`
            : `User ${user.profile?.firstName || user.email} does not have a medical license on file`
        };
      }

      const oldLicenseNumber = user.providerInfo.licenseNumber;

      // Remove license information
      const updateResult = await SecureDataAccess.update(
        usersCollection,
        userFilter,
        {
          $unset: {
            'providerInfo.licenseNumber': 1,
            'providerInfo.licenseState': 1,
            'providerInfo.licenseExpiry': 1
          }
        },
        {
          serviceId: this.serviceName,
          operation: 'removeDoctorLicense',
          practiceId: practiceContext.practiceId || 'global'
        }
      );

      if (!updateResult) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'שגיאה בהסרת רישיון'
            : 'Failed to remove license'
        };
      }

      return {
        success: true,
        message: practiceContext.language === 'he'
          ? `✅ רישיון רפואי ${oldLicenseNumber} הוסר בהצלחה מ-${user.profile?.firstName || user.email}`
          : `✅ Medical license ${oldLicenseNumber} has been successfully removed from ${user.profile?.firstName || user.email}`,
        userId: user._id?.toString() || user.email,
        removedLicense: oldLicenseNumber
      };

    } catch (error) {
      console.error('Error removing provider license:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהסרת רישיון: ${error.message}`
          : `Error removing license: ${error.message}`
      };
    }
  }

async getDoctorLicense(params, practiceContext, session) {
    console.log('🔍 Starting getDoctorLicense:', { params, practiceContext });

    try {
      // Extract user ID from params
      let userId = params.userId || params.userEmail || params.email;

      // Handle 'me' case OR no userId provided - use current user from session
      if (userId === 'me' || !userId) {
        // Try to get current user from practiceContext first (from chat context)
        if (practiceContext.currentUser?.email || practiceContext.currentUser?._id) {
          userId = practiceContext.currentUser.email || practiceContext.currentUser._id;
        }
        // Fallback to session user
        else if (session?.user?.email || session?.user?._id) {
          userId = session.user.email || session.user._id;
        }
        // If still no user found, return error
        else {
          return {
            success: false,
            message: practiceContext.language === 'he'
              ? 'לא נמצא משתמש נוכחי בהפעלה'
              : 'No current user found in session'
          };
        }
      }

      // Find user
      const usersCollection = practiceContext.isGlobalPractice ? 'Users' : 'users';
      const userFilter = userId.includes('@') ? { email: userId } : { _id: userId };

      const users = await SecureDataAccess.query(
        usersCollection,
        userFilter,
        {},
        {
          serviceId: this.serviceName,
          operation: 'getDoctorLicense',
          practiceId: practiceContext.practiceId || 'global'
        }
      );

      if (!users || users.length === 0) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'משתמש לא נמצא'
            : 'User not found'
        };
      }

      const user = users[0];

      // Check if user has license information
      if (!user.providerInfo?.licenseNumber) {
        return {
          success: true,
          message: practiceContext.language === 'he'
            ? `למשתמש ${user.profile?.firstName || user.email} אין רישיון רפואי רשום במערכת`
            : `User ${user.profile?.firstName || user.email} does not have a medical license on file`,
          hasLicense: false
        };
      }

      // Build license info message
      let message = practiceContext.language === 'he'
        ? `📋 פרטי רישיון רפואי עבור ${user.profile?.firstName || user.email}:\n`
        : `📋 Medical license details for ${user.profile?.firstName || user.email}:\n`;

      message += practiceContext.language === 'he'
        ? `\n🔢 מספר רישיון: ${user.providerInfo.licenseNumber}`
        : `\n🔢 License number: ${user.providerInfo.licenseNumber}`;

      if (user.providerInfo.licenseState) {
        message += practiceContext.language === 'he'
          ? `\n📍 מדינה/אזור: ${user.providerInfo.licenseState}`
          : `\n📍 State/Region: ${user.providerInfo.licenseState}`;
      }

      if (user.providerInfo.licenseExpiry) {
        const expiryDate = new Date(user.providerInfo.licenseExpiry);
        const isExpired = expiryDate < new Date();
        const dateStr = expiryDate.toLocaleDateString(practiceContext.language === 'he' ? 'he-IL' : 'en-US');

        message += practiceContext.language === 'he'
          ? `\n📅 תאריך תפוגה: ${dateStr}${isExpired ? ' ⚠️ פג תוקף!' : ''}`
          : `\n📅 Expiry date: ${dateStr}${isExpired ? ' ⚠️ Expired!' : ''}`;
      }

      return {
        success: true,
        message: message,
        hasLicense: true,
        licenseData: {
          licenseNumber: user.providerInfo.licenseNumber,
          licenseState: user.providerInfo.licenseState,
          licenseExpiry: user.providerInfo.licenseExpiry
        }
      };

    } catch (error) {
      console.error('Error getting provider license:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בקבלת פרטי רישיון: ${error.message}`
          : `Error getting license details: ${error.message}`
      };
    }
  }

async checkDoctorStatus(params, practiceContext, session) {
    console.log('👤 Checking provider status for current user');

    try {
      // Get current user from context
      const currentUser = practiceContext.user;

      if (!currentUser) {
        return {
          success: false,
          hasProvider: false,
          message: practiceContext.language === 'he'
            ? "לא נמצא משתמש מחובר. אנא התחבר למערכת."
            : "No authenticated user found. Please log in to the system."
        };
      }

      // A provider is a user with a clinical role (doctor/nurse). Legacy role
      // strings are normalized to canonical roles before the check.
      const userRoles = currentUser.roles || [];
      const isProvider = roleModel.rolesAreClinical(userRoles);

      // Also check for provider info
      const hasProviderInfo = currentUser.providerInfo && currentUser.providerInfo.licenseNumber;

      if (isProvider || hasProviderInfo) {
        let message = practiceContext.language === 'he'
          ? "✅ **אתה רשום כספק רפואי במערכת**\n\n"
          : "✅ **You are registered as a medical provider**\n\n";

        // Add role information
        if (userRoles.length > 0) {
          message += practiceContext.language === 'he'
            ? `**תפקידים:** ${userRoles.join(', ')}\n`
            : `**Roles:** ${userRoles.join(', ')}\n`;
        }

        // Add provider info if available
        if (hasProviderInfo) {
          message += practiceContext.language === 'he'
            ? `**רישיון רפואי:** ${currentUser.providerInfo.licenseNumber}\n`
            : `**Medical License:** ${currentUser.providerInfo.licenseNumber}\n`;

          if (currentUser.providerInfo.specialty) {
            message += practiceContext.language === 'he'
              ? `**התמחות:** ${currentUser.providerInfo.specialty}\n`
              : `**Specialty:** ${currentUser.providerInfo.specialty}\n`;
          }

          if (currentUser.providerInfo.npi) {
            message += practiceContext.language === 'he'
              ? `**NPI:** ${currentUser.providerInfo.npi}\n`
              : `**NPI:** ${currentUser.providerInfo.npi}\n`;
          }
        }

        message += practiceContext.language === 'he'
          ? "\nאתה יכול לגשת לכל הפונקציות של ספקי שירות כולל צפייה בתורים, ניהול מטופלים ועוד."
          : "\nYou have access to all provider functions including viewing appointments, managing patients, and more.";

        return {
          success: true,
          hasProvider: true,
          isProvider: true,
          providerInfo: currentUser.providerInfo,
          roles: userRoles,
          message: message
        };
      } else {
        let message = practiceContext.language === 'he'
          ? "❌ **אינך רשום כספק רפואי במערכת**\n\n"
          : "❌ **You are not registered as a medical provider**\n\n";

        message += practiceContext.language === 'he'
          ? "## כדי להירשם כספק רפואי:\n\n"
          : "## To register as a medical provider:\n\n";

        message += practiceContext.language === 'he'
          ? "1. **פנה למנהל המערכת** - בקש להוסיף אותך כספק רפואי\n"
          : "1. **Contact System Administrator** - Request to be added as a medical provider\n";

        message += practiceContext.language === 'he'
          ? "2. **הכן את המסמכים הבאים:**\n"
          : "2. **Prepare the following documents:**\n";

        message += practiceContext.language === 'he'
          ? "   • רישיון רפואי תקף\n"
          : "   • Valid medical license\n";

        message += practiceContext.language === 'he'
          ? "   • מספר NPI (לארה״ב)\n"
          : "   • NPI number (for US)\n";

        message += practiceContext.language === 'he'
          ? "   • פרטי התמחות\n\n"
          : "   • Specialty information\n\n";

        message += practiceContext.language === 'he'
          ? "3. **לאחר האישור** - תקבל גישה לכל הפונקציות של ספקי שירות"
          : "3. **After approval** - You'll have access to all provider functions";

        return {
          success: true,
          hasProvider: false,
          isProvider: false,
          message: message
        };
      }

    } catch (error) {
      console.error('Error checking provider status:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בבדיקת סטטוס ספק: ${error.message}`
          : `Error checking provider status: ${error.message}`
      };
    }
  }

async getPatientProvider(params, practiceContext, session) {
    try {
      // DATABASE OPERATION: Refactored from callAPI to SecureDataAccess
      const getProvidersContext = {
        serviceId: this.serviceName,
        operation: 'get_providers',
        practiceId: practiceContext?.subdomain || practiceContext?.practiceId,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      const isHebrew = session?.language === 'he';

      // Query users with providerInfo (providers are users with provider role)
      const filter = { 'providerInfo.providerId': { $exists: true } };
      if (params.specialty) {
        filter['providerInfo.specialties'] = params.specialty;
      }
      if (params.department) {
        filter['providerInfo.departments'] = params.department;
      }
      if (params.status) {
        filter['providerInfo.status'] = params.status;
      }

      const providers = await SecureDataAccess.query(
        'users',
        filter,
        { sort: { 'providerInfo.name': 1 } },
        getProvidersContext
      );

      // Map to provider format
      const providerData = providers.map(user => ({
        name: user.providerInfo?.name || user.profile?.name || `${user.profile?.firstName} ${user.profile?.lastName}`,
        providerId: user.providerInfo?.providerId,
        specialties: user.providerInfo?.specialties || [],
        departments: user.providerInfo?.departments || [],
        status: user.providerInfo?.status || 'active',
        userId: user._id
      }));

      if (providerData && providerData.length > 0) {
        let message = isHebrew
          ? `נמצאו ${providerData.length} ספקי שירות:\n`
          : `Found ${providerData.length} providers:\n`;

        providerData.forEach(provider => {
          message += `\n• ${provider.name} (${provider.providerId})`;
          if (provider.specialties?.length > 0) {
            message += ` - ${provider.specialties.join(', ')}`;
          }
          if (provider.departments?.length > 0) {
            message += ` | ${provider.departments.join(', ')}`;
          }
          message += ` [${provider.status}]`;
        });

        return {
          success: true,
          message,
          data: providerData,
          displayType: 'openArtifactPanel',
          artifactPanel: {
            patientId: params.patientId,  // CRITICAL: Required for artifact panel to open
            level: 'detail',
            category: 'patient_provider',
            documentId: null,
            type: 'document',  // Specify document mode (not grid)
            data: { providers: providerData }
          }
        };
      }

      return {
        success: true,
        message: isHebrew ? 'לא נמצאו ספקי שירות' : 'No providers found',
        data: []
      };
    } catch (error) {
      console.error('Error getting providers:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בקבלת ספקים' : 'Error getting providers',
        error: error.message
      };
    }
  }

async setupUserAsDoctor(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      
      // Find the user first
      let userId = params.userId;
      let user = null;
      
      // If email provided instead of ID, search for user
      if (params.userId && params.userId.includes('@')) {
        const searchResult = await this.searchUsers({ searchTerm: params.userId }, practiceContext, session);
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          user = searchResult.data[0];
          userId = user._id;
        } else {
          throw new Error(isHebrew ? 'משתמש לא נמצא' : 'User not found');
        }
      } else if (practiceContext.models?.User) {
        const lookupContext = this.createSecureContext(practiceContext, 'setupUserAsDoctor');
        const lookupRes = await practiceContext.models.SecureDataAccess.query('users', { _id: userId }, { limit: 1 }, lookupContext);
        user = Array.isArray(lookupRes) ? lookupRes[0] : (lookupRes?.data?.[0] ?? null);
        if (!user) {
          throw new Error(isHebrew ? 'משתמש לא נמצא' : 'User not found');
        }
      }
      
      // Generate readable provider ID if not exists
      let providerId = user?.providerInfo?.providerId;

      if (!providerId) {
        const firstName = (user?.profile?.firstName || 'User').toLowerCase();
        const lastName = (user?.profile?.lastName || 'user').toLowerCase();
        let baseProviderId = `PROV-${firstName}-${lastName}`.replace(/\s+/g, '-');

        // Check for duplicates and add suffix if needed
        const SecureDataAccess = require('./secureDataAccess');
        const existingProviders = await SecureDataAccess.query(
          'users',
          { 'providerInfo.providerId': { $regex: `^${baseProviderId}(-\d+)?$` } },
          { projection: { 'providerInfo.providerId': 1 } },
          {
            serviceId: this.serviceName,
            operation: 'checkDuplicateProviderId',
            practiceId: practiceContext.practiceId || 'global'
          }
        );

        providerId = baseProviderId;
        if (existingProviders && existingProviders.length > 0) {
          // Find the highest suffix number
          let maxSuffix = 0;
          existingProviders.forEach(provider => {
            const id = provider.providerInfo?.providerId;
            if (id === baseProviderId) {
              maxSuffix = Math.max(maxSuffix, 1);
            } else {
              const match = id?.match(/-(\d+)$/);
              if (match) {
                maxSuffix = Math.max(maxSuffix, parseInt(match[1]) + 1);
              }
            }
          });
          if (maxSuffix > 0) {
            providerId = `${baseProviderId}-${maxSuffix}`;
          }
        }
      }
      
      // Set up provider settings
      const providerSettings = {
        providerId: providerId,
        licenseNumber: params.licenseNumber || user?.providerInfo?.licenseNumber || '',
        specialties: params.specialties || user?.providerInfo?.specialties || [],
        departments: params.departments || user?.providerInfo?.departments || [],
        appointmentSettings: {
          defaultDuration: params.appointmentDuration || 30,
          bufferTime: 5,
          maxAdvanceBooking: 90,
          allowOnlineBooking: true,
          workingHours: params.workingHours || {
            sunday: { start: '08:00', end: '17:00', isWorking: true },
            monday: { start: '08:00', end: '17:00', isWorking: true },
            tuesday: { start: '08:00', end: '17:00', isWorking: true },
            wednesday: { start: '08:00', end: '17:00', isWorking: true },
            thursday: { start: '08:00', end: '17:00', isWorking: true },
            friday: { start: '08:00', end: '14:00', isWorking: true },
            saturday: { isWorking: false }
          }
        }
      };
      
      // Update user with provider info using SecureDataAccess
      const updateContext = this.createSecureContext(practiceContext, 'setupUserAsDoctor');

      await SecureDataAccess.update(
        'users',
        userId.includes('@') ? { email: userId } : { _id: userId },
        {
          // 'provider' is NOT a role — a schedulable provider is a clinical role
          // (doctor/nurse) plus providerInfo. We only set up providerInfo/calendar
          // here; clinical role assignment is handled separately (e.g. addUserRole).
          $set: { providerInfo: providerSettings } // Set provider info
        },
        updateContext
      );

      // TODO: Implement provider availability management
      // This would require creating a provideravailabilities collection and managing schedules
      // For now, the provider is set up without availability configuration
      
      // Format success message
      let message = isHebrew 
        ? `✅ המשתמש הוגדר כספק שירות בהצלחה!\n\n`
        : `✅ User successfully set up as provider!\n\n`;
      
      if (user) {
        const displayName = `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.email;
        message += isHebrew ? `👤 משתמש: ${displayName}\n` : `👤 User: ${displayName}\n`;
      }
      
      // Provider ID is for internal use only - not shown to users
      message += isHebrew ? `⏰ משך פגישה: ${params.appointmentDuration || 30} דקות\n` : `⏰ Appointment Duration: ${params.appointmentDuration || 30} minutes\n`;
      
      if (params.specialties?.length > 0) {
        message += isHebrew ? `🔬 התמחויות: ${params.specialties.join(', ')}\n` : `🔬 Specialties: ${params.specialties.join(', ')}\n`;
      }
      
      if (params.departments?.length > 0) {
        message += isHebrew ? `🏢 מחלקות: ${params.departments.join(', ')}\n` : `🏢 Departments: ${params.departments.join(', ')}\n`;
      }
      
      message += isHebrew 
        ? `\n📅 לוח זמנים זמין ומוכן לקבלת פגישות!`
        : `\n📅 Calendar is available and ready to accept appointments!`;
      
      return {
        success: true,
        message: message,
        providerId: providerId,
        userId: userId,
        data: {
          providerInfo: providerSettings
        }
      };
      
    } catch (error) {
      console.error('Error setting up user as provider:', error);
      return {
        success: false,
        message: session?.language === 'he' 
          ? `שגיאה בהגדרת משתמש כספק שירות: ${error.message}`
          : `Error setting up user as provider: ${error.message}`,
        error: error.message
      };
    }
  }

async setupMultipleDoctors(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      
      // Parse users if it's a string (from Claude API)
      let users = params.users;
      if (typeof users === 'string') {
        try {
          users = JSON.parse(users);
        } catch (e) {
          // If it's not JSON, try to split by comma
          users = users.split(',').map(u => u.trim());
        }
      }
      
      // Validate input
      if (!users || !Array.isArray(users) || users.length === 0) {
        throw new Error(isHebrew ? 'רשימת משתמשים נדרשת' : 'User list required');
      }
      
      const results = {
        success: [],
        failed: [],
        totalProcessed: 0
      };
      
      // Process each user
      for (const userIdentifier of users) {
        results.totalProcessed++;
        
        try {
          // First update role to doctor if specified (handle string "true" from API)
          const shouldUpdateRole = params.updateRole === true || params.updateRole === 'true';
          if (shouldUpdateRole) {
            const roleResult = await this.addUserRole({
              userId: userIdentifier,
              role: params.role || 'doctor'
            }, practiceContext, session);
            
            if (!roleResult.success) {
              throw new Error(roleResult.message || 'Role update failed');
            }
          }
          
          // Then setup as provider
          const providerResult = await this.setupUserAsDoctor({
            userId: userIdentifier,
            appointmentDuration: params.appointmentDuration || 30,
            specialties: params.specialties,
            departments: params.departments
          }, practiceContext, session);
          
          if (providerResult.success) {
            results.success.push({
              user: userIdentifier,
              providerId: providerResult.providerId,
              message: providerResult.message
            });
          } else {
            results.failed.push({
              user: userIdentifier,
              error: providerResult.message
            });
          }
        } catch (error) {
          results.failed.push({
            user: userIdentifier,
            error: error.message
          });
        }
      }
      
      // Format response message
      let message = isHebrew 
        ? `סיכום הגדרת ספקים:\n`
        : `Provider setup summary:\n`;
      
      message += isHebrew 
        ? `✅ הצליחו: ${results.success.length}\n`
        : `✅ Successful: ${results.success.length}\n`;
      
      if (results.success.length > 0) {
        message += isHebrew ? `המשתמשים הבאים הוגדרו כספקים:\n` : `The following users are now providers:\n`;
        results.success.forEach(item => {
          const userPart = item.user.includes('@') ? item.user : `User ${item.user}`;
          message += `• ${userPart}\n`;
        });
      }
      
      if (results.failed.length > 0) {
        message += isHebrew 
          ? `\n❌ נכשלו: ${results.failed.length}\n`
          : `\n❌ Failed: ${results.failed.length}\n`;
        results.failed.forEach(item => {
          message += `• ${item.user}: ${item.error}\n`;
        });
      }
      
      return {
        success: results.failed.length === 0,
        message: message,
        data: results
      };
      
    } catch (error) {
      console.error('Error in bulk provider setup:', error);
      return {
        success: false,
        message: session?.language === 'he' 
          ? `שגיאה בהגדרת ספקים: ${error.message}`
          : `Error setting up providers: ${error.message}`,
        error: error.message
      };
    }
  }

async blockDoctorTime(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      // TODO: Replace with SecureDataAccess - needs availability/blocked_time collection implementation
      // This function needs to be implemented with direct database access

      return {
        success: false,
        message: isHebrew
          ? 'פונקציה זו טרם הוטמעה - נדרש לעדכן את מערכת הזמינות'
          : 'This function is not yet implemented - availability system update needed',
        error: 'Not implemented'
      };
    } catch (error) {
      console.error('Error blocking provider time:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בחסימת זמן' : 'Error blocking time',
        error: error.message
      };
    }
  }

async getDoctorMeetings(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';

      // Get current user's provider info
      const currentUser = practiceContext.user;
      if (!currentUser) {
        return {
          success: false,
          message: isHebrew
            ? 'משתמש לא מחובר למערכת'
            : 'User not authenticated'
        };
      }

      // Create secure context for database operation
      const context = this.createSecureContext(practiceContext, 'getDoctorMeetings');

      // First, get the user's appointment IDs from their user document
      const userFilter = currentUser.email ? { email: currentUser.email } : { _id: currentUser._id };
      const users = await SecureDataAccess.query(
        'users',
        userFilter,
        { projection: { 'appointments.asProvider': 1, 'appointments.asPatient': 1 } },
        context
      );

      if (!users || users.length === 0) {
        return {
          success: false,
          message: isHebrew ? 'משתמש לא נמצא' : 'User not found'
        };
      }

      const user = users[0];
      const appointmentIds = user.appointments?.asProvider || [];

      if (appointmentIds.length === 0) {
        return {
          success: true,
          message: isHebrew ? 'לא נמצאו פגישות' : 'No appointments found',
          data: []
        };
      }

      // Convert string IDs to ObjectIds for query
      const objectIds = appointmentIds.map(id => {
        try {
          return typeof id === 'string' ? new ObjectId(id) : id;
        } catch (e) {
          console.log(`Invalid ObjectId: ${id}`);
          return null;
        }
      }).filter(id => id !== null);

      if (objectIds.length === 0) {
        return {
          success: true,
          message: isHebrew ? 'לא נמצאו פגישות תקינות' : 'No valid appointments found',
          data: []
        };
      }

      // Query appointments using the IDs from the user document
      const filter = {
        _id: { $in: objectIds }
      };

      // Add status filter if needed
      if (!params.includeAll) {
        filter.status = { $in: ['scheduled', 'confirmed'] };
      }

      // Add date filter if provided
      if (params.startDate || params.endDate) {
        filter.scheduledDate = {};
        if (params.startDate) {
          filter.scheduledDate.$gte = new Date(params.startDate);
        }
        if (params.endDate) {
          filter.scheduledDate.$lte = new Date(params.endDate);
        }
      }

      // Query appointments from database
      const appointments = await SecureDataAccess.query(
        'appointments',
        filter,
        {
          sort: { scheduledDate: 1, scheduledTime: 1 },
          limit: params.limit || 100
        },
        context
      );

      if (appointments && appointments.length > 0) {
        let message = isHebrew
          ? `נמצאו ${appointments.length} פגישות (מתוך ${appointmentIds.length} רשומות):\n`
          : `Found ${appointments.length} appointments (out of ${appointmentIds.length} records):\n`;

        appointments.forEach(appointment => {
          const date = new Date(appointment.scheduledDate).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US');

          message += `\n• ${appointment.appointmentReason || appointment.appointmentType}`;
          message += ` - ${appointment.patientName}`;
          message += ` - ${date} ${appointment.scheduledTime}`;
          message += ` [${appointment.status}]`;
          message += ` (ID: ${appointment._id})`;
        });

        // Note if some IDs didn't match
        if (appointments.length < objectIds.length) {
          const foundIds = appointments.map(a => a._id.toString());
          const missingCount = objectIds.length - appointments.length;
          message += isHebrew
            ? `\n\nהערה: ${missingCount} פגישות ישנות נמחקו מהמערכת`
            : `\n\nNote: ${missingCount} old appointments have been removed from the system`;
        }

        return {
          success: true,
          message,
          data: appointments,
          totalRecords: appointmentIds.length,
          foundRecords: appointments.length
        };
      }

      return {
        success: true,
        message: isHebrew
          ? `לא נמצאו פגישות פעילות (${appointmentIds.length} רשומות ישנות)`
          : `No active appointments found (${appointmentIds.length} old records)`,
        data: [],
        totalRecords: appointmentIds.length,
        foundRecords: 0
      };
    } catch (error) {
      console.error('Error getting provider meetings:', error);
      return {
        success: false,
        message: session?.language === 'he'
          ? 'שגיאה בקבלת פגישות מקצועיות'
          : 'Error getting provider meetings',
        error: error.message
      };
    }
  }

async removeDoctorInfo(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      const context = this.createSecureContext(practiceContext, 'removeDoctorInfo');

      // Resolve the target user ('me' => current authenticated user, else email or id)
      let userId = params.userId;
      if (!userId || userId === 'me') {
        const cu = practiceContext.currentUser || practiceContext.user;
        userId = cu?.email || cu?.id || cu?._id;
      }
      if (!userId) {
        throw new Error(isHebrew ? 'חסר מזהה משתמש' : 'Missing user id');
      }

      const filter = String(userId).includes('@') ? { email: userId } : { _id: userId };

      // Inverse of setupUserAsDoctor: remove only the scheduling/calendar setup (providerInfo).
      // The clinical role (doctor/nurse) is intentionally left unchanged.
      const result = await SecureDataAccess.update(
        'users',
        filter,
        { $unset: { providerInfo: '' } },
        context
      );

      return {
        success: true,
        message: isHebrew
          ? '✅ הוסרה הגדרת היומן/הזמינות מהמשתמש (התפקיד הקליני לא שונה).'
          : '✅ Removed the calendar/availability (providerInfo) setup from the user. The clinical role was not changed.',
        data: result
      };
    } catch (error) {
      console.error('Error removing doctor info:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בהסרת הגדרות הרופא' : 'Error removing doctor info',
        error: error.message
      };
    }
  }

async updateDoctorSettings(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';

      // Create secure context for database operation
      const context = this.createSecureContext(practiceContext, 'updateDoctorSettings');

      // Update provider settings in the users collection
      const updateData = {
        $set: {}
      };

      // Map settings to providerInfo fields
      if (params.appointmentDuration !== undefined) {
        updateData.$set['providerInfo.appointmentSettings.defaultDuration'] = params.appointmentDuration;
      }
      if (params.specialties) {
        updateData.$set['providerInfo.specialties'] = params.specialties;
      }
      if (params.departments) {
        updateData.$set['providerInfo.departments'] = params.departments;
      }
      if (params.workingHours) {
        updateData.$set['providerInfo.appointmentSettings.workingHours'] = params.workingHours;
      }

      const filter = params.userId.includes('@')
        ? { email: params.userId }
        : { _id: params.userId };

      const result = await SecureDataAccess.update(
        'users',
        filter,
        updateData,
        context
      );

      return {
        success: true,
        message: isHebrew ? 'הגדרות ספק עודכנו בהצלחה' : 'Provider settings updated successfully',
        data: params
      };
    } catch (error) {
      console.error('Error updating provider settings:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בעדכון הגדרות' : 'Error updating settings',
        error: error.message
      };
    }
  }

async deleteDoctorMeetings(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';

      // Get current user
      const currentUser = practiceContext.user;
      if (!currentUser) {
        return {
          success: false,
          message: isHebrew
            ? 'משתמש לא מחובר למערכת'
            : 'User not authenticated'
        };
      }

      // Create secure context for database operation
      const context = this.createSecureContext(practiceContext, 'deleteDoctorMeetings');

      // First, get the user's appointment IDs
      const userFilter = currentUser.email ? { email: currentUser.email } : { _id: currentUser._id };
      const users = await SecureDataAccess.query(
        'users',
        userFilter,
        { projection: { 'appointments.asProvider': 1 } },
        context
      );

      if (!users || users.length === 0) {
        return {
          success: false,
          message: isHebrew ? 'משתמש לא נמצא' : 'User not found'
        };
      }

      const user = users[0];
      const appointmentIds = user.appointments?.asProvider || [];

      if (appointmentIds.length === 0) {
        return {
          success: true,
          message: isHebrew ? 'אין פגישות למחוק' : 'No appointments to delete',
          deletedCount: 0
        };
      }

      // Convert string IDs to ObjectIds
      const objectIds = appointmentIds.map(id => {
        try {
          return typeof id === 'string' ? new ObjectId(id) : id;
        } catch (e) {
          return null;
        }
      }).filter(id => id !== null);

      // Delete appointments from appointments collection
      let deleteFilter = {
        _id: { $in: objectIds }
      };

      // Only delete specific IDs if provided
      if (params.appointmentIds && params.appointmentIds.length > 0) {
        const specificIds = params.appointmentIds.map(id => {
          try {
            return typeof id === 'string' ? new ObjectId(id) : id;
          } catch (e) {
            return null;
          }
        }).filter(id => id !== null);

        // Only delete appointments that are both in user's list and requested list
        deleteFilter._id.$in = objectIds.filter(id =>
          specificIds.some(specificId => specificId.equals(id))
        );
      }

      // Add option to only delete scheduled appointments (not completed ones)
      if (!params.includeCompleted) {
        deleteFilter.status = { $in: ['scheduled', 'confirmed', 'cancelled'] };
      }

      // Delete the appointments
      const deleteResult = await SecureDataAccess.delete(
        'appointments',
        deleteFilter,
        context,
        { returnDeletedCount: true }
      );

      const deletedCount = deleteResult?.deletedCount || 0;

      // Update user document to remove deleted appointment IDs
      if (deletedCount > 0) {
        // Get the IDs that were actually deleted
        const remainingAppointments = await SecureDataAccess.query(
          'appointments',
          { _id: { $in: objectIds } },
          { projection: { _id: 1 } },
          context
        );

        const remainingIds = remainingAppointments.map(a => a._id.toString());
        const updatedProviderAppointments = appointmentIds.filter(id =>
          remainingIds.includes(id.toString())
        );

        // Update user's appointment list
        await SecureDataAccess.update(
          'users',
          userFilter,
          { $set: { 'appointments.asProvider': updatedProviderAppointments } },
          context
        );
      }

      return {
        success: true,
        message: isHebrew
          ? `נמחקו ${deletedCount} פגישות בהצלחה`
          : `Successfully deleted ${deletedCount} appointments`,
        deletedCount: deletedCount,
        totalRecords: appointmentIds.length
      };
    } catch (error) {
      console.error('Error deleting provider meetings:', error);
      return {
        success: false,
        message: session?.language === 'he'
          ? 'שגיאה במחיקת פגישות'
          : 'Error deleting appointments',
        error: error.message
      };
    }
  }

  /**
   * Assign all patients to a provider
   * Creates patient_provider records for all patients that don't have this provider assigned
   * @param {Object} params - { providerName, providerEmail, providerId, facility, specialty, assignToUnassignedOnly }
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session context
   * @returns {Object} Result with assigned count
   */
  // ============================================================================
  // MEETING TOOLS - NEW FUNCTIONS (Task 02)
  // ============================================================================

  /**
   * Schedule a professional meeting between two providers
   * Stores as an appointment with appointmentType: 'provider_meeting'
   */
  async scheduleDoctorMeeting(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      const currentUser = practiceContext.user || practiceContext.currentUser;

      if (!currentUser) {
        return { success: false, message: isHebrew ? 'משתמש לא מחובר' : 'User not authenticated' };
      }

      const context = this.createSecureContext(practiceContext, 'scheduleDoctorMeeting');

      // Resolve target provider by name or email
      let targetProviderName = params.targetProvider;
      let targetProviderId = null;

      if (params.targetProvider) {
        const users = await SecureDataAccess.query('users', {
          $or: [
            { email: new RegExp(params.targetProvider, 'i') },
            { firstName: new RegExp(params.targetProvider, 'i') },
            { lastName: new RegExp(params.targetProvider, 'i') },
            { fullName: new RegExp(params.targetProvider, 'i') },
            { 'providerInfo.name': new RegExp(params.targetProvider, 'i') }
          ]
        }, { limit: 1 }, context);

        if (users && users.length > 0) {
          const targetUser = users[0];
          targetProviderId = targetUser._id.toString();
          targetProviderName = targetUser.fullName || `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim() || targetUser.email;
        }
      }

      // Build meeting record as an appointment
      const meetingDate = params.date ? new Date(params.date) : new Date();
      const meeting = {
        appointmentType: 'provider_meeting',
        scheduledDate: meetingDate,
        scheduledTime: params.time || '09:00',
        duration: params.duration || 30,
        status: 'scheduled',
        subject: params.subject || (isHebrew ? 'פגישה מקצועית' : 'Professional Meeting'),
        description: params.description || '',
        meetingType: params.type || 'general',
        organizerName: currentUser.fullName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email,
        organizerId: currentUser._id?.toString() || currentUser.id,
        attendeeName: targetProviderName,
        attendeeId: targetProviderId,
        location: params.location || '',
        agenda: params.agenda || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const created = await SecureDataAccess.insert('appointments', meeting, context);

      // Link to organizer's appointments.asProvider array
      const organizerFilter = currentUser.email ? { email: currentUser.email } : { _id: currentUser._id };
      await SecureDataAccess.update('users', organizerFilter, {
        $push: { 'appointments.asProvider': created._id.toString() }
      }, context);

      // Link to attendee's appointments.asProvider array if found
      if (targetProviderId) {
        await SecureDataAccess.update('users', { _id: new ObjectId(targetProviderId) }, {
          $push: { 'appointments.asProvider': created._id.toString() }
        }, context);
      }

      return {
        success: true,
        message: isHebrew
          ? `פגישה נקבעה עם ${targetProviderName} ב-${params.date} ${params.time}`
          : `Meeting scheduled with ${targetProviderName} on ${params.date} at ${params.time}`,
        data: { meetingId: created._id, ...meeting }
      };
    } catch (error) {
      console.error('Error scheduling provider meeting:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בקביעת פגישה' : 'Error scheduling meeting',
        error: error.message
      };
    }
  }

  /**
   * Find overlapping available time slots for two providers
   */
  async getAvailableMeetingTimes(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      const context = this.createSecureContext(practiceContext, 'getAvailableMeetingTimes');

      const { provider1, provider2, startDate, endDate, duration = 30 } = params;

      if (!provider1 || !provider2) {
        return { success: false, message: isHebrew ? 'נדרשים שני ספקים' : 'Two providers are required' };
      }

      // Resolve provider IDs from names/emails
      const resolveProvider = async (nameOrId) => {
        if (!nameOrId) return null;
        // Check if it's already a provider ID
        if (nameOrId.startsWith && nameOrId.startsWith('PROV-')) {
          const providers = await SecureDataAccess.query('users', {
            'providerInfo.providerId': nameOrId
          }, { limit: 1 }, context);
          return providers?.[0] || null;
        }
        // Search by name/email
        const users = await SecureDataAccess.query('users', {
          $or: [
            { email: new RegExp(nameOrId, 'i') },
            { firstName: new RegExp(nameOrId, 'i') },
            { lastName: new RegExp(nameOrId, 'i') },
            { fullName: new RegExp(nameOrId, 'i') },
            { 'providerInfo.name': new RegExp(nameOrId, 'i') }
          ]
        }, { limit: 1 }, context);
        return users?.[0] || null;
      };

      const prov1 = await resolveProvider(provider1);
      const prov2 = await resolveProvider(provider2);

      if (!prov1) {
        return { success: false, message: isHebrew ? `לא נמצא ספק: ${provider1}` : `Provider not found: ${provider1}` };
      }
      if (!prov2) {
        return { success: false, message: isHebrew ? `לא נמצא ספק: ${provider2}` : `Provider not found: ${provider2}` };
      }

      const prov1Id = prov1.providerInfo?.providerId || prov1._id.toString();
      const prov2Id = prov2.providerInfo?.providerId || prov2._id.toString();
      const prov1Name = prov1.fullName || `${prov1.firstName || ''} ${prov1.lastName || ''}`.trim();
      const prov2Name = prov2.fullName || `${prov2.firstName || ''} ${prov2.lastName || ''}`.trim();

      // Determine date range (default: next 5 business days)
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

      const availabilityService = require('./availabilityService');
      if (!availabilityService.initialized) await availabilityService.initialize();

      const overlappingSlots = [];
      const currentDate = new Date(start);

      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        // Skip Saturday (6) and Sunday (0) if desired - keeping Sunday for US
        if (dayOfWeek === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const dateStr = currentDate.toISOString().split('T')[0];

        try {
          const [slots1, slots2] = await Promise.all([
            availabilityService.getAvailableSlots({ providerId: prov1Id, date: dateStr, duration }, practiceContext),
            availabilityService.getAvailableSlots({ providerId: prov2Id, date: dateStr, duration }, practiceContext)
          ]);

          const times1 = new Set((slots1?.data || []).filter(s => s.available).map(s => s.time));
          const times2 = new Set((slots2?.data || []).filter(s => s.available).map(s => s.time));

          // Find overlapping times
          const overlap = [...times1].filter(t => times2.has(t)).sort();

          if (overlap.length > 0) {
            overlappingSlots.push({
              date: dateStr,
              dayName: currentDate.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', { weekday: 'long' }),
              availableTimes: overlap,
              count: overlap.length
            });
          }
        } catch (err) {
          console.error(`Error checking availability for ${dateStr}:`, err.message);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const totalSlots = overlappingSlots.reduce((sum, d) => sum + d.count, 0);

      return {
        success: true,
        message: isHebrew
          ? `נמצאו ${totalSlots} זמנים משותפים ל-${prov1Name} ו-${prov2Name}`
          : `Found ${totalSlots} common available times for ${prov1Name} and ${prov2Name}`,
        data: {
          provider1: prov1Name,
          provider2: prov2Name,
          duration,
          dateRange: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
          availableDays: overlappingSlots,
          totalAvailableSlots: totalSlots
        }
      };
    } catch (error) {
      console.error('Error getting available meeting times:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בבדיקת זמינות' : 'Error checking availability',
        error: error.message
      };
    }
  }

  /**
   * Create a recurring meeting series
   * Creates individual appointment records linked by a seriesId
   */
  async createRecurringMeeting(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      const currentUser = practiceContext.user || practiceContext.currentUser;

      if (!currentUser) {
        return { success: false, message: isHebrew ? 'משתמש לא מחובר' : 'User not authenticated' };
      }

      const context = this.createSecureContext(practiceContext, 'createRecurringMeeting');

      const {
        targetProvider, subject, description, time, duration = 30,
        frequency, endDate, numberOfOccurrences, daysOfWeek,
        location, type, agenda
      } = params;

      if (!frequency) {
        return { success: false, message: isHebrew ? 'נדרש סוג תדירות' : 'Frequency is required (daily, weekly, biweekly, monthly)' };
      }

      // Resolve target provider
      let targetProviderName = targetProvider || '';
      let targetProviderId = null;
      if (targetProvider) {
        const users = await SecureDataAccess.query('users', {
          $or: [
            { email: new RegExp(targetProvider, 'i') },
            { firstName: new RegExp(targetProvider, 'i') },
            { lastName: new RegExp(targetProvider, 'i') },
            { fullName: new RegExp(targetProvider, 'i') },
            { 'providerInfo.name': new RegExp(targetProvider, 'i') }
          ]
        }, { limit: 1 }, context);
        if (users && users.length > 0) {
          const u = users[0];
          targetProviderId = u._id.toString();
          targetProviderName = u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
        }
      }

      // Generate series ID
      const seriesId = `SERIES-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      // Calculate occurrence dates
      const startDate = params.startDate ? new Date(params.startDate) : new Date();
      const maxEnd = endDate ? new Date(endDate) : null;
      const maxOccurrences = numberOfOccurrences || 52; // Default 1 year of weekly
      const dates = [];
      const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

      let current = new Date(startDate);
      let count = 0;

      while (count < maxOccurrences) {
        if (maxEnd && current > maxEnd) break;

        const shouldInclude = (() => {
          if (frequency === 'daily') return true;
          if (frequency === 'weekly' || frequency === 'biweekly') {
            if (daysOfWeek && daysOfWeek.length > 0) {
              const dayNum = current.getDay();
              return daysOfWeek.some(d => dayMap[d.toLowerCase()] === dayNum);
            }
            return current.getDay() === startDate.getDay();
          }
          if (frequency === 'monthly') {
            return current.getDate() === startDate.getDate();
          }
          return false;
        })();

        if (shouldInclude) {
          dates.push(new Date(current));
          count++;
        }

        // Advance date
        if (frequency === 'daily') {
          current.setDate(current.getDate() + 1);
        } else if (frequency === 'weekly') {
          if (daysOfWeek && daysOfWeek.length > 0) {
            current.setDate(current.getDate() + 1); // Check day by day for multi-day weekly
          } else {
            current.setDate(current.getDate() + 7);
          }
        } else if (frequency === 'biweekly') {
          if (daysOfWeek && daysOfWeek.length > 0) {
            current.setDate(current.getDate() + 1);
          } else {
            current.setDate(current.getDate() + 14);
          }
        } else if (frequency === 'monthly') {
          current.setMonth(current.getMonth() + 1);
        } else {
          break; // Unknown frequency
        }

        // Safety: don't generate more than 2 years out
        if (current.getTime() - startDate.getTime() > 730 * 24 * 60 * 60 * 1000) break;
      }

      if (dates.length === 0) {
        return { success: false, message: isHebrew ? 'לא נוצרו תאריכים' : 'No dates generated for the recurrence pattern' };
      }

      // Create individual meeting records
      const organizerName = currentUser.fullName || `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email;
      const organizerId = currentUser._id?.toString() || currentUser.id;
      const meetingIds = [];

      for (const meetingDate of dates) {
        const meeting = {
          appointmentType: 'provider_meeting',
          scheduledDate: meetingDate,
          scheduledTime: time || '09:00',
          duration: duration,
          status: 'scheduled',
          subject: subject || (isHebrew ? 'פגישה חוזרת' : 'Recurring Meeting'),
          description: description || '',
          meetingType: type || 'general',
          organizerName, organizerId,
          attendeeName: targetProviderName,
          attendeeId: targetProviderId,
          location: location || '',
          agenda: agenda || '',
          seriesId,
          recurrence: { frequency, daysOfWeek, endDate: maxEnd?.toISOString(), numberOfOccurrences: dates.length },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const created = await SecureDataAccess.insert('appointments', meeting, context);
        meetingIds.push(created._id.toString());
      }

      // Link all meetings to organizer
      const organizerFilter = currentUser.email ? { email: currentUser.email } : { _id: currentUser._id };
      await SecureDataAccess.update('users', organizerFilter, {
        $push: { 'appointments.asProvider': { $each: meetingIds } }
      }, context);

      // Link to attendee if found
      if (targetProviderId) {
        await SecureDataAccess.update('users', { _id: new ObjectId(targetProviderId) }, {
          $push: { 'appointments.asProvider': { $each: meetingIds } }
        }, context);
      }

      return {
        success: true,
        message: isHebrew
          ? `נוצרו ${dates.length} פגישות חוזרות (${frequency}) עם ${targetProviderName}`
          : `Created ${dates.length} recurring meetings (${frequency}) with ${targetProviderName}`,
        data: {
          seriesId,
          frequency,
          totalMeetings: dates.length,
          firstDate: dates[0].toISOString().split('T')[0],
          lastDate: dates[dates.length - 1].toISOString().split('T')[0],
          time: time || '09:00',
          attendee: targetProviderName,
          meetingIds
        }
      };
    } catch (error) {
      console.error('Error creating recurring meeting:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה ביצירת פגישות חוזרות' : 'Error creating recurring meetings',
        error: error.message
      };
    }
  }

  /**
   * Get all instances of a recurring meeting series
   */
  async getRecurringMeetingSeries(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      const context = this.createSecureContext(practiceContext, 'getRecurringMeetingSeries');

      if (!params.seriesId) {
        return { success: false, message: isHebrew ? 'נדרש מזהה סדרה' : 'Series ID is required' };
      }

      const meetings = await SecureDataAccess.query('appointments', {
        seriesId: params.seriesId
      }, { sort: { scheduledDate: 1 }, limit: 200 }, context);

      if (!meetings || meetings.length === 0) {
        return {
          success: false,
          message: isHebrew ? `לא נמצאה סדרה: ${params.seriesId}` : `Series not found: ${params.seriesId}`
        };
      }

      const first = meetings[0];
      let message = isHebrew
        ? `סדרת פגישות "${first.subject}" - ${meetings.length} מופעים:\n`
        : `Meeting series "${first.subject}" - ${meetings.length} instances:\n`;

      meetings.forEach((m, i) => {
        const date = new Date(m.scheduledDate).toLocaleDateString(isHebrew ? 'he-IL' : 'en-US');
        message += `\n${i + 1}. ${date} ${m.scheduledTime} [${m.status}]`;
        if (m.attendeeName) message += ` - ${m.attendeeName}`;
      });

      return {
        success: true,
        message,
        data: {
          seriesId: params.seriesId,
          subject: first.subject,
          frequency: first.recurrence?.frequency,
          totalInstances: meetings.length,
          meetings: meetings.map(m => ({
            meetingId: m._id,
            date: new Date(m.scheduledDate).toISOString().split('T')[0],
            time: m.scheduledTime,
            status: m.status,
            attendee: m.attendeeName
          }))
        }
      };
    } catch (error) {
      console.error('Error getting recurring meeting series:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בקבלת סדרת פגישות' : 'Error getting meeting series',
        error: error.message
      };
    }
  }

  /**
   * Update a recurring meeting - supports scope: thisOnly, thisAndFuture, all
   */
  async updateRecurringMeeting(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      const context = this.createSecureContext(practiceContext, 'updateRecurringMeeting');

      const { seriesId, meetingId, scope = 'thisOnly', date, time, subject, description, location, agenda, status } = params;

      if (!seriesId) {
        return { success: false, message: isHebrew ? 'נדרש מזהה סדרה' : 'Series ID is required' };
      }

      // Build update fields
      const updateFields = {};
      if (date) updateFields.scheduledDate = new Date(date);
      if (time) updateFields.scheduledTime = time;
      if (subject) updateFields.subject = subject;
      if (description !== undefined) updateFields.description = description;
      if (location !== undefined) updateFields.location = location;
      if (agenda !== undefined) updateFields.agenda = agenda;
      if (status) updateFields.status = status;
      updateFields.updatedAt = new Date();

      if (Object.keys(updateFields).length <= 1) { // Only updatedAt
        return { success: false, message: isHebrew ? 'לא סופקו שדות לעדכון' : 'No update fields provided' };
      }

      let filter;
      let updatedCount = 0;

      if (scope === 'thisOnly' && meetingId) {
        // Update only this specific instance
        filter = { _id: new ObjectId(meetingId), seriesId };
        await SecureDataAccess.update('appointments', filter, { $set: updateFields }, context);
        updatedCount = 1;

      } else if (scope === 'thisAndFuture') {
        // Get the reference meeting to find its date
        let referenceDate;
        if (meetingId) {
          const meetings = await SecureDataAccess.query('appointments', {
            _id: new ObjectId(meetingId)
          }, { limit: 1 }, context);
          referenceDate = meetings?.[0]?.scheduledDate;
        } else if (date) {
          referenceDate = new Date(date);
        }

        if (!referenceDate) {
          return { success: false, message: isHebrew ? 'נדרש מזהה פגישה או תאריך' : 'Meeting ID or date required for thisAndFuture scope' };
        }

        // Get all future meetings in the series
        const futureMeetings = await SecureDataAccess.query('appointments', {
          seriesId,
          scheduledDate: { $gte: new Date(referenceDate) }
        }, { limit: 200 }, context);

        for (const meeting of futureMeetings) {
          await SecureDataAccess.update('appointments', { _id: meeting._id }, { $set: updateFields }, context);
          updatedCount++;
        }

      } else { // 'all'
        const allMeetings = await SecureDataAccess.query('appointments', { seriesId }, { limit: 200 }, context);
        for (const meeting of allMeetings) {
          await SecureDataAccess.update('appointments', { _id: meeting._id }, { $set: updateFields }, context);
          updatedCount++;
        }
      }

      return {
        success: true,
        message: isHebrew
          ? `עודכנו ${updatedCount} פגישות בסדרה (${scope})`
          : `Updated ${updatedCount} meetings in series (scope: ${scope})`,
        data: { seriesId, scope, updatedCount, updatedFields: Object.keys(updateFields).filter(k => k !== 'updatedAt') }
      };
    } catch (error) {
      console.error('Error updating recurring meeting:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה בעדכון פגישות חוזרות' : 'Error updating recurring meetings',
        error: error.message
      };
    }
  }

  /**
   * Delete an entire recurring meeting series or future instances
   */
  async deleteRecurringMeetingSeries(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      const context = this.createSecureContext(practiceContext, 'deleteRecurringMeetingSeries');

      const { seriesId, scope = 'all', meetingId } = params;

      if (!seriesId) {
        return { success: false, message: isHebrew ? 'נדרש מזהה סדרה' : 'Series ID is required' };
      }

      let filter = { seriesId };
      let deletedCount = 0;

      if (scope === 'thisAndFuture' && meetingId) {
        // Get reference meeting date
        const meetings = await SecureDataAccess.query('appointments', {
          _id: new ObjectId(meetingId)
        }, { limit: 1 }, context);
        const referenceDate = meetings?.[0]?.scheduledDate;

        if (referenceDate) {
          filter.scheduledDate = { $gte: new Date(referenceDate) };
        }
      }

      // Get all meetings that will be deleted (to clean up user references)
      const meetingsToDelete = await SecureDataAccess.query('appointments', filter, { limit: 200 }, context);

      if (meetingsToDelete.length === 0) {
        return { success: false, message: isHebrew ? `לא נמצאו פגישות בסדרה` : `No meetings found in series: ${seriesId}` };
      }

      const meetingIdsToRemove = meetingsToDelete.map(m => m._id.toString());

      // Delete the meetings
      for (const meeting of meetingsToDelete) {
        await SecureDataAccess.delete('appointments', { _id: meeting._id }, context);
        deletedCount++;
      }

      // Clean up organizer and attendee user references
      const first = meetingsToDelete[0];
      if (first.organizerId) {
        try {
          await SecureDataAccess.update('users', { _id: new ObjectId(first.organizerId) }, {
            $pull: { 'appointments.asProvider': { $in: meetingIdsToRemove } }
          }, context);
        } catch (e) { /* non-critical */ }
      }
      if (first.attendeeId) {
        try {
          await SecureDataAccess.update('users', { _id: new ObjectId(first.attendeeId) }, {
            $pull: { 'appointments.asProvider': { $in: meetingIdsToRemove } }
          }, context);
        } catch (e) { /* non-critical */ }
      }

      return {
        success: true,
        message: isHebrew
          ? `נמחקו ${deletedCount} פגישות מסדרה "${first.subject}"`
          : `Deleted ${deletedCount} meetings from series "${first.subject}"`,
        data: { seriesId, deletedCount, scope }
      };
    } catch (error) {
      console.error('Error deleting recurring meeting series:', error);
      return {
        success: false,
        message: session?.language === 'he' ? 'שגיאה במחיקת סדרת פגישות' : 'Error deleting meeting series',
        error: error.message
      };
    }
  }

  async assignAllPatientsToDoctor(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      let {
        providerName,
        providerEmail,
        providerId,
        facility = practiceContext?.practiceName || 'Main Facility',
        specialty = 'Primary Care',
        providerRole = 'Primary Care Physician',
        assignToUnassignedOnly = false
      } = params;

      // If provider info not provided, use current session user
      if (!providerName && !providerEmail && session) {
        providerName = session.userName || session.providerName;
        providerEmail = session.userEmail || session.email;
        providerId = session.userId || session.providerId;
        console.log(`[AssignAllPatients] Using session user: ${providerName} (${providerEmail})`);
      }

      // Validate we have provider info
      if (!providerName && !providerEmail) {
        return {
          success: false,
          message: isHebrew 
            ? 'נדרש שם ספק או אימייל. אנא ציינו את שמכם או האימייל שלכם'
            : 'Provider name or email is required. Please specify your name or email',
          error: 'Missing provider identification'
        };
      }

      console.log(`[AssignAllPatients] Starting assignment for provider: ${providerName || providerEmail}`);

      // Create secure context
      const context = this.createSecureContext(practiceContext, 'assignAllPatientsToDoctor');

      // Step 1: Get all patients
      const allPatients = await SecureDataAccess.query(
        'patients',
        {},
        { projection: { _id: 1, firstName: 1, lastName: 1 } },
        context
      );

      if (!allPatients || allPatients.length === 0) {
        return {
          success: true,
          message: isHebrew ? 'לא נמצאו מטופלים במערכת' : 'No patients found in the system',
          assignedCount: 0,
          totalPatients: 0
        };
      }

      console.log(`[AssignAllPatients] Found ${allPatients.length} total patients`);

      // Step 2: Get existing patient_provider relationships for this provider
      // Use email as primary identifier for matching (FDA Recall searches by email)
      const providerIdentifier = providerEmail || providerName || providerId;
      const existingRelationships = await SecureDataAccess.query(
        'patient_provider',
        {
          provider: { $regex: providerIdentifier, $options: 'i' }
        },
        { projection: { patientId: 1, provider: 1 } },
        context
      );
      
      console.log(`[AssignAllPatients] Found ${existingRelationships.length} existing relationships for ${providerIdentifier}`);

      const assignedPatientIds = new Set(
        existingRelationships.map(rel => String(rel.patientId))
      );

      console.log(`[AssignAllPatients] Provider already has ${assignedPatientIds.size} assigned patients`);

      // Step 3: Filter patients to assign
      const patientsToAssign = allPatients.filter(patient => {
        const patientId = String(patient._id);
        
        // If assignToUnassignedOnly is true, only assign patients with no provider
        if (assignToUnassignedOnly) {
          // This would require checking all patient_provider records
          // For now, we'll just skip patients already assigned to this provider
          return !assignedPatientIds.has(patientId);
        }
        
        // Otherwise, assign all patients not already assigned to this provider
        return !assignedPatientIds.has(patientId);
      });

      console.log(`[AssignAllPatients] Will assign ${patientsToAssign.length} patients`);

      // Step 4: Create patient_provider records
      const assignedRecords = [];
      const currentDate = new Date();
      const errors = [];
      
      console.log(`[AssignAllPatients] Using provider identifier: ${providerIdentifier}`);

      for (const patient of patientsToAssign) {
        try {
          const patientProviderRecord = {
            patientId: patient._id,
            date: currentDate,
            provider: providerIdentifier,
            facility: facility,
            providerSpecialty: specialty,
            providerRole: providerRole,
            encounterType: 'Primary Care',
            visitDuration: 30,
            createdAt: currentDate,
            updatedAt: currentDate
          };

          const created = await SecureDataAccess.insert(
            'patient_provider',
            patientProviderRecord,
            context
          );

          assignedRecords.push({
            patientId: patient._id,
            patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
            recordId: created._id
          });
        } catch (error) {
          console.error(`[AssignAllPatients] Error assigning patient ${patient._id}:`, error);
          errors.push({
            patientId: patient._id,
            error: error.message
          });
        }
      }

      console.log(`[AssignAllPatients] Successfully assigned ${assignedRecords.length} patients`);

      // Return success message
      const message = isHebrew
        ? `שויכו ${assignedRecords.length} מתוך ${patientsToAssign.length} מטופלים בהצלחה ל${providerName || providerEmail}`
        : `Successfully assigned ${assignedRecords.length} of ${patientsToAssign.length} patients to ${providerName || providerEmail}`;

      return {
        success: true,
        message: message,
        assignedCount: assignedRecords.length,
        totalPatients: allPatients.length,
        alreadyAssigned: assignedPatientIds.size,
        errors: errors.length > 0 ? errors : undefined,
        displayType: 'openArtifactPanel',
        artifactPanel: {
          type: 'document',
          title: isHebrew ? 'שיוך מטופלים' : 'Patient Assignment Results',
          category: 'patient_provider',
          data: {
            assigned: assignedRecords,
            summary: {
              total: allPatients.length,
              assigned: assignedRecords.length,
              alreadyAssigned: assignedPatientIds.size,
              errors: errors.length
            }
          }
        }
      };

    } catch (error) {
      console.error('[AssignAllPatients] Error:', error);
      return {
        success: false,
        message: session?.language === 'he'
          ? 'שגיאה בשיוך מטופלים'
          : 'Error assigning patients',
        error: error.message
      };
    }
  }

}

module.exports = new ProviderService();
