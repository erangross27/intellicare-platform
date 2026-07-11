/**
 * UserService
 *
 * Domain: user
 * Extracted from: agentServiceV4.js
 * Functions: 20
 *
 * Purpose: Handle all user-related operations including authentication, roles, and permissions
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

class UserService {
  constructor() {
    this.serviceName = 'userService';
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
  // PERMISSION DEFAULTS BY ROLE
  // ============================================================================

  /**
   * Generate default permissions based on user role.
   * Uses medicalCollectionsService to dynamically include all medical collections.
   */
  _getDefaultPermissions(role) {
    role = roleModel.primaryRole([role]);
    let allCollections = [];
    try {
      const medicalCollections = require('./medicalCollectionsService');
      allCollections = medicalCollections.getAllCollections() || [];
    } catch (e) {
      console.warn('⚠️ Could not load medicalCollectionsService for permissions generation');
    }

    // Full read+write for all medical collections
    const medicalFullAccess = allCollections.flatMap(c => [`read:${c}`, `write:${c}`]);

    const coreAdmin = [
      'system_admin',
      'manage_users', 'assign_roles', 'view_reports',
      'manage_practice_settings', 'manage_billing', 'view_audit_logs'
    ];

    const coreReadWrite = [
      'read_patients', 'write_patients', 'delete_patients', 'export_patients',
      'read_documents', 'write_documents', 'delete_documents', 'export_documents',
      'upload_documents', 'orders_create', 'orders_manage_results'
    ];

    const coreNursing = [
      'read_patients', 'write_patients',
      'read_documents', 'write_documents',
      'upload_documents'
    ];

    const coreReadOnly = [
      'read_patients', 'read_documents'
    ];

    switch (role) {
      case 'admin':
        return [...coreAdmin, ...coreReadWrite, ...medicalFullAccess];

      case 'doctor':
        return [...coreReadWrite, ...medicalFullAccess];

      case 'nurse':
        return [...coreNursing, ...medicalFullAccess];

      case 'user':
        return coreReadOnly;

      default:
        return coreReadOnly;
    }
  }

  // ============================================================================
  // SERVICE FUNCTIONS - EXTRACTED FROM agentServiceV4.js
  // ============================================================================

async createUser(params, practiceContext, session) {
    try {
      // Validate required fields
      if (!params.email) {
        throw new Error(practiceContext.language === 'he'
          ? 'כתובת אימייל נדרשת'
          : 'Email address is required');
      }

      if (!params.firstName || !params.lastName) {
        throw new Error(practiceContext.language === 'he'
          ? 'שם פרטי ומשפחה נדרשים'
          : 'First name and last name are required');
      }

      if (!params.role) {
        throw new Error(practiceContext.language === 'he'
          ? 'תפקיד נדרש'
          : 'Role is required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(params.email)) {
        throw new Error(practiceContext.language === 'he'
          ? 'פורמט אימייל לא תקין'
          : 'Invalid email format');
      }

      // Validate role (canonical roles only)
      const validRoles = roleModel.CANONICAL_ROLES;
      if (!validRoles.includes(params.role)) {
        throw new Error(practiceContext.language === 'he'
          ? `תפקיד לא תקין. אפשרויות: ${roleModel.CANONICAL_ROLES.join(', ')}`
          : `Invalid role. Options: ${roleModel.CANONICAL_ROLES.join(', ')}`);
      }

      // Create secure context for database operations
      const context = this.createSecureContext(practiceContext, 'create-user');

      // Check if user already exists
      const existingUsers = await SecureDataAccess.query('users', { email: params.email.toLowerCase() }, { limit: 1 }, context);
      if (existingUsers && existingUsers.length > 0) {
        throw new Error(practiceContext.language === 'he'
          ? 'משתמש עם אימייל זה כבר קיים'
          : 'A user with this email already exists');
      }

      // Generate provider ID
      const firstName = (params.firstName || 'User').toLowerCase();
      const lastName = (params.lastName || 'user').toLowerCase();
      let baseProviderId = `PROV-${firstName}-${lastName}`.replace(/\s+/g, '-');

      // Check for duplicate provider IDs
      const existingProviders = await SecureDataAccess.query(
        'users',
        { 'providerInfo.providerId': { $regex: `^${baseProviderId}(-\\d+)?$` } },
        { projection: { 'providerInfo.providerId': 1 } },
        context
      );

      let providerId = baseProviderId;
      if (existingProviders && existingProviders.length > 0) {
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

      // Determine provider type based on role (canonical)
      const providerType = params.role === 'doctor' ? 'doctor' :
                           params.role === 'nurse' ? 'nurse' :
                           roleModel.primaryRole([params.role]);

      // Determine practice subdomain for row-level security
      const practiceSubdomain = practiceContext.subdomain || practiceContext.practiceSubdomain || practiceContext.practiceId || 'global';

      // Build the complete user document
      const userData = {
        email: params.email.toLowerCase(),
        isPasswordless: true,
        emailVerified: params.skipEmailVerification !== false,
        practiceSubdomain: practiceSubdomain,
        profile: {
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          title: params.title
        },
        roles: roleModel.normalizeRoles([params.role]),
        permissions: params.permissions && params.permissions.length > 0
          ? params.permissions
          : this._getDefaultPermissions(params.role),
        status: 'active',
        preferredLanguage: params.language || practiceContext.language || 'he',
        timezone: params.timezone || 'Asia/Jerusalem',
        providerInfo: {
          providerId: providerId,
          licenseNumber: params.licenseNumber || '',
          specialties: params.specialization ? [params.specialization] : [],
          departments: params.department ? [params.department] : [],
          appointmentSettings: {
            defaultDuration: params.appointmentDuration || 30,
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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Insert user directly via SecureDataAccess
      const insertResult = await SecureDataAccess.insert('users', userData, context);
      const userId = insertResult?._id || insertResult?.insertedId;

      if (!userId) {
        throw new Error('User was inserted but no ID was returned');
      }

      const fullName = `${params.firstName} ${params.lastName}`;
      const isHebrew = practiceContext.language === 'he';

      return {
        success: true,
        data: { user: { _id: userId, ...userData } },
        userId: userId,
        providerId: providerId,
        providerType: providerType,
        message: isHebrew
          ? `משתמש ${fullName} נוצר בהצלחה עם תפקיד ${params.role}`
          : `User ${fullName} created successfully with role ${params.role}`,
        permissions: userData.permissions
      };

    } catch (error) {
      console.error('Error creating user:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה ביצירת משתמש: ${error.message}`
          : `Error creating user: ${error.message}`
      };
    }
  }

async searchUsers(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';

      // Import SecureDataAccess for direct database access
      const SecureDataAccess = require('./secureDataAccess');
      
      // Build search query
      const query = {};
      const orConditions = [];
      
      // Add status filter
      if (!params.includeInactive) {
        query.status = { $in: ['active', 'pending_approval'] };
      }
      
      // Add role filter if specified
      if (params.role) {
        // Use $in to check if role exists in the roles array
        query.roles = { $in: [params.role] };
      }
      
      // Add email filter if specified (direct match)
      if (params.email) {
        query.email = params.email.toLowerCase();
        console.log('🔍 SearchUsers: Looking for email:', params.email.toLowerCase());

        // DEBUG: Let's check if the user exists directly
        // Create temporary context for debug query
        const debugContext = {
          serviceId: this.serviceName,
          operation: 'search-users-debug',
          practiceId: practiceContext.practiceSubdomain || practiceContext.practiceId || session?.practiceSubdomain,
          practiceSubdomain: practiceContext.practiceSubdomain || session?.practiceSubdomain,
          apiKey: this.serviceAuth?.apiKey || this.serviceToken
        };
        const testUser = await SecureDataAccess.query('users', { email: params.email.toLowerCase() }, { limit: 1 }, debugContext)[0];
        console.log('🔍 DEBUG: Direct email search result:', testUser ? 'User found!' : 'User NOT found');
        if (testUser) {
          console.log('   Email:', testUser.email);
          console.log('   Roles:', testUser.roles);
          console.log('   Status:', testUser.status);
          console.log('   Has provider in roles?', testUser.roles.includes('provider'));
          console.log('   Provider info exists?', !!testUser.providerInfo);
          console.log('   Provider ID:', testUser.providerInfo?.providerId);
        }
      }
      
      // Add search term conditions if provided
      if (params.searchTerm && !params.email) {
        const searchRegex = new RegExp(params.searchTerm, 'i');
        
        // Search in basic fields
        orConditions.push(
          { 'profile.firstName': searchRegex },
          { 'profile.lastName': searchRegex },
          { 'profile.title': searchRegex },
          { 'email': searchRegex }
        );
        
        // Handle Hebrew-English name translations
        const hebrewToEnglish = {
          'כהן': 'cohen',
          'לוי': 'levi',
          'דוד': 'david',
          'שרה': 'sarah',
          'משה': 'moshe',
          'יוסף': 'joseph',
          'יוסי': 'yossi',
          'אברהם': 'abraham',
          'יצחק': 'isaac',
          'יעקב': 'jacob',
          'רחל': 'rachel',
          'לאה': 'leah'
        };
        
        const englishToHebrew = {};
        for (const [heb, eng] of Object.entries(hebrewToEnglish)) {
          englishToHebrew[eng] = heb;
        }
        
        // Check if search term has a translation
        const lowerSearch = String(params.searchTerm).toLowerCase();
        if (hebrewToEnglish[params.searchTerm]) {
          // Hebrew search - also search English equivalent
          const englishVersion = hebrewToEnglish[params.searchTerm];
          orConditions.push(
            { 'profile.firstName': new RegExp(englishVersion, 'i') },
            { 'profile.lastName': new RegExp(englishVersion, 'i') }
          );
        } else if (englishToHebrew[lowerSearch]) {
          // English search - also search Hebrew equivalent
          const hebrewVersion = englishToHebrew[lowerSearch];
          orConditions.push(
            { 'profile.firstName': new RegExp(hebrewVersion, 'i') },
            { 'profile.lastName': new RegExp(hebrewVersion, 'i') }
          );
        }
        
        // Also search for full name combinations
        const nameParts = params.searchTerm.split(' ').filter(p => p);
        if (nameParts.length > 1) {
          // Search for "firstName lastName" or "title firstName lastName"
          orConditions.push({
            $and: [
              { 'profile.firstName': new RegExp(nameParts[0], 'i') },
              { 'profile.lastName': new RegExp(nameParts[nameParts.length - 1], 'i') }
            ]
          });
        }
      }
      
      // Combine conditions
      if (orConditions.length > 0 && !params.email) {
        query.$or = orConditions;
      }
      
      // Execute search
      console.log('🔍 SearchUsers: Final query:', JSON.stringify(query));

      // Create context for SecureDataAccess - Use subdomain for proper routing
      const practiceIdentifier = practiceContext.practiceSubdomain || practiceContext.practiceId || session?.practiceSubdomain;
      const context = {
        serviceId: this.serviceName,
        operation: 'search-users',
        practiceId: practiceIdentifier,  // Use subdomain for database routing
        practiceSubdomain: practiceContext.practiceSubdomain || session?.practiceSubdomain,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      const users = await SecureDataAccess.query('users', query, { limit: 50 }, context);
      console.log('🔍 SearchUsers: Found', users.length, 'users');
      
      // Debug: Show what users were found
      if (users.length === 0 && params.email) {
        console.log('❌ No users found with email + role query. Checking without role filter...');
        const withoutRoleResult = await SecureDataAccess.query('users', { email: params.email.toLowerCase() }, { limit: 1 }, context);
        const withoutRole = withoutRoleResult[0];
        if (withoutRole) {
          console.log('   Found user WITHOUT role filter:');
          console.log('   Email:', withoutRole.email);
          console.log('   Roles:', withoutRole.roles);
          console.log('   Role query was:', query.roles);
        }
      }
      
      // Format results
      let message = isHebrew 
        ? `נמצאו ${users.length} משתמשים:\n\n`
        : `Found ${users.length} users:\n\n`;
      
      users.forEach(user => {
        // Build display name
        let displayName = '';
        if (user.profile?.title) {
          displayName = user.profile.title + ' ';
        }
        if (user.profile?.firstName || user.profile?.lastName) {
          displayName += `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim();
        }
        if (!displayName) {
          displayName = user.email;
        }
        
        message += `👤 ${displayName}\n`;
        message += `   📧 ${user.email}\n`;
        
        // Add role information
        if (user.roles && user.roles.length > 0) {
          const roleDisplay = roleModel.normalizeRoles(user.roles)
            .map(r => roleModel.roleLabel(r, isHebrew ? 'he' : 'en'))
            .join(', ');
          message += `   💼 ${isHebrew ? 'תפקיד' : 'Role'}: ${roleDisplay}\n`;
        }
        
        // Add provider info if this is a provider
        if (user.providerInfo?.providerId) {
          message += `   🏥 ${isHebrew ? 'ספק שירות' : 'Provider'} ID: ${user.providerInfo.providerId}\n`;
          if (user.providerInfo.specialties?.length > 0) {
            message += `   🔬 ${isHebrew ? 'התמחות' : 'Specialty'}: ${user.providerInfo.specialties.join(', ')}\n`;
          }
        }
        
        // Add status
        const statusDisplay = user.status === 'active' 
          ? (isHebrew ? '✅ פעיל' : '✅ Active')
          : user.status === 'pending_approval'
          ? (isHebrew ? '⏳ ממתין לאישור' : '⏳ Pending Approval')
          : (isHebrew ? '❌ לא פעיל' : '❌ Inactive');
        message += `   ${statusDisplay}\n\n`;
      });
      
      return {
        success: true,
        message: message,
        data: users,
        count: users.length
      };
      
    } catch (error) {
      console.error('Error searching users:', error);
      return {
        success: false,
        message: session?.language === 'he' 
          ? 'שגיאה בחיפוש משתמשים' 
          : 'Error searching users',
        error: error.message
      };
    }
  }

async addUserRole(params, practiceContext, session) {
    try {
      console.log('🔑 addUserRole called with:', {
        userId: params.userId,
        role: params.role,
        hasUser: !!practiceContext.user,
        userEmail: practiceContext.user?.email,
        practiceSubdomain: practiceContext.practiceSubdomain || practiceContext.subdomain,
        practiceId: practiceContext.practiceId,
        allContextKeys: Object.keys(practiceContext)
      });

      // Handle "my role" or "me" by using current user's email
      if (!params.userId || params.userId === 'me' || params.userId === 'my' || params.userId === 'current') {
        // Look for user info in practiceContext.user (not currentUser)
        if (practiceContext.user?.email) {
          params.userId = practiceContext.user.email;
          console.log(`📝 Updating role for current user: ${params.userId}`);
        } else if (practiceContext.user?.id) {
          // Try using user ID if email not available
          params.userId = practiceContext.user.id;
          console.log(`📝 Updating role for current user ID: ${params.userId}`);
        } else {
          console.error('❌ No user information found in practiceContext:', practiceContext.user);
          throw new Error(practiceContext.language === 'he'
            ? 'לא נמצא מידע על המשתמש הנוכחי. אנא ציין את כתובת המייל או מזהה המשתמש'
            : 'Current user information not found. Please specify email or user ID');
        }
      }

      if (!params.role) {
        throw new Error(practiceContext.language === 'he'
          ? 'תפקיד נדרש'
          : 'Role is required');
      }

      // Validate role - canonical roles only
      const validRoles = roleModel.CANONICAL_ROLES;
      if (!validRoles.includes(params.role)) {
        throw new Error(practiceContext.language === 'he'
          ? `תפקיד לא תקין. אפשרויות: ${validRoles.join(', ')}`
          : `Invalid role. Options: ${validRoles.join(', ')}`);
      }

      // Get the user data and ID
      let actualUserId;
      let currentUser;
      let currentRoles = [];

      // Search for the user - use email if it's an email address
      let searchParams = {};
      if (params.userId.includes('@')) {
        searchParams = { email: params.userId };
      } else {
        searchParams = { searchTerm: params.userId };
      }

      const searchResult = await this.searchUsers(searchParams, practiceContext, session);
      if (!searchResult.data || searchResult.data.length === 0) {
        throw new Error(practiceContext.language === 'he'
          ? `משתמש ${params.userId} לא נמצא`
          : `User ${params.userId} not found`);
      }

      currentUser = searchResult.data[0];
      actualUserId = currentUser._id || currentUser.id;
      currentRoles = currentUser.roles || [];
      console.log(`📝 Found user: ${currentUser.email || params.userId}, ID: ${actualUserId}, Current roles: ${currentRoles.join(', ')}`);

      // Add the new role if not already present
      if (!currentRoles.includes(params.role)) {
        currentRoles.push(params.role);
        console.log(`✅ Adding role ${params.role} to user. New roles: ${currentRoles.join(', ')}`);
      } else {
        console.log(`ℹ️ User already has role ${params.role}`);
      }

      // Use SecureDataAccess directly - the agent runs in backend context
      console.log('🔄 Updating user roles directly via SecureDataAccess:', {
        userId: actualUserId,
        practiceSubdomain: practiceContext.practiceSubdomain || practiceContext.subdomain,
        practiceId: practiceContext.practiceId,
        roles: currentRoles
      });

      // Import SecureDataAccess if not already imported
      const SecureDataAccess = require('./secureDataAccess');

      // Create context for SecureDataAccess
      const context = {
        serviceId: this.serviceName,
        operation: 'update-user-roles',
        practiceId: practiceContext.practiceSubdomain || practiceContext.subdomain || practiceContext.practiceId,
        practiceSubdomain: practiceContext.practiceSubdomain || practiceContext.subdomain,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // Update the user directly
      const updateResponse = await SecureDataAccess.update(
        'users',
        { _id: actualUserId },
        { $set: { roles: currentRoles } },
        context
      );

      // Initialize provider setup result
      let providerSetupResult = null;

      // SecureDataAccess.update returns the update result directly
      if (updateResponse && (updateResponse.modifiedCount > 0 || updateResponse.matchedCount > 0)) {
        console.log('✅ User roles updated successfully via SecureDataAccess');

        // If a clinical (schedulable) role was added, also set up provider object
        const providerRoles = roleModel.CLINICAL_ROLES;
        if (providerRoles.includes(params.role) && !currentUser.providerInfo?.providerId) {
          console.log('🔄 Clinical role added - setting up provider object...');

          try {
            // setupUserAsDoctor lives on the providerService singleton (not on UserService).
            // Lazy-require here to dispatch correctly and avoid any circular-require at load time.
            const providerService = require('./providerService');
            // Call setupUserAsDoctor to create the schedulable-clinician (calendar) object
            providerSetupResult = await providerService.setupUserAsDoctor({
              userId: currentUser.email || actualUserId,
              appointmentDuration: 30,
              specialties: ['General Practice'],
              departments: ['Primary Care']
            }, practiceContext, session);

            if (providerSetupResult.success) {
              console.log('✅ Provider object created successfully');
            } else {
              console.log('⚠️ Provider object creation had issues:', providerSetupResult.message);
            }
          } catch (providerError) {
            console.log('⚠️ Could not create provider object:', providerError.message);
            // Don't fail the whole operation if provider setup fails
            // The role has been added successfully
          }
        }
      } else {
        throw new Error(practiceContext.language === 'he'
          ? 'עדכון התפקיד נכשל'
          : 'Failed to update role');
      }

      // Return success with updated user data
      const isProvider = roleModel.isClinicalRole(params.role);

      // Build provider setup message if provider was created
      let providerDetails = '';
      if (isProvider && providerSetupResult?.success) {
        const workingHours = providerSetupResult.data?.providerInfo?.appointmentSettings?.workingHours || {};

        // Format working hours nicely
        const dayNames = practiceContext.language === 'he'
          ? { sunday: 'ראשון', monday: 'שני', tuesday: 'שלישי', wednesday: 'רביעי', thursday: 'חמישי', friday: 'שישי', saturday: 'שבת' }
          : { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

        let hoursText = practiceContext.language === 'he' ? '\n\n📅 שעות קבלה:' : '\n\n📅 Working Hours:';
        for (const [day, hours] of Object.entries(workingHours)) {
          if (hours.isWorking) {
            hoursText += `\n• ${dayNames[day]}: ${hours.start} - ${hours.end}`;
          }
        }

        const providerId = providerSetupResult.data?.providerInfo?.providerId;
        providerDetails = practiceContext.language === 'he'
          ? `\n\n✅ הגדרות ספק השירות נוצרו בהצלחה!\n🆔 מזהה ספק: ${providerId}\n⏱️ משך פגישה ברירת מחדל: 30 דקות${hoursText}`
          : `\n\n✅ Provider settings created successfully!\n🆔 Provider ID: ${providerId}\n⏱️ Default appointment duration: 30 minutes${hoursText}`;
      } else if (isProvider) {
        providerDetails = practiceContext.language === 'he'
          ? '\n✅ הגדרות ספק השירות נוצרו אוטומטית'
          : '\n✅ Provider settings created automatically';
      }

      return {
        success: true,
        data: {
          _id: actualUserId,
          email: currentUser.email,
          roles: currentRoles,
          providerInfo: providerSetupResult?.data?.providerInfo
        },
        userId: actualUserId,
        userEmail: currentUser.email,
        message: practiceContext.language === 'he'
          ? currentRoles.length > 1
            ? `התפקיד ${params.role} נוסף בהצלחה. תפקידים נוכחיים: ${currentRoles.join(', ')}${providerDetails}`
            : `התפקיד של המשתמש עודכן בהצלחה ל-${params.role}${providerDetails}`
          : currentRoles.length > 1
            ? `Role ${params.role} added successfully. Current roles: ${currentRoles.join(', ')}${providerDetails}`
            : `User role successfully updated to ${params.role}${providerDetails}`,
        previousRoles: searchResult.data[0].roles || [],
        currentRoles: currentRoles,
        addedRole: params.role,
        providerSetup: providerSetupResult
      };
      
    } catch (error) {
      console.error('Error updating user role:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בעדכון תפקיד: ${error.message}`
          : `Error updating role: ${error.message}`
      };
    }
  }

async removeUserRole(params, practiceContext, session) {
    try {
      console.log('🔑 removeUserRole called with:', {
        userId: params.userId,
        role: params.role,
        hasUser: !!practiceContext.user,
        userEmail: practiceContext.user?.email,
        practiceSubdomain: practiceContext.practiceSubdomain || practiceContext.subdomain,
        practiceId: practiceContext.practiceId,
        allContextKeys: Object.keys(practiceContext)
      });

      // Handle "my role" or "me" by using current user's email
      if (!params.userId || params.userId === 'me' || params.userId === 'my' || params.userId === 'current') {
        // Look for user info in practiceContext.user (not currentUser)
        if (practiceContext.user?.email) {
          params.userId = practiceContext.user.email;
          console.log(`📝 Removing role for current user: ${params.userId}`);
        } else if (practiceContext.user?.id) {
          // Try using user ID if email not available
          params.userId = practiceContext.user.id;
          console.log(`📝 Removing role for current user ID: ${params.userId}`);
        } else {
          console.error('❌ No user information found in practiceContext:', practiceContext.user);
          throw new Error(practiceContext.language === 'he'
            ? 'לא נמצא מידע על המשתמש הנוכחי. אנא ציין את כתובת המייל או מזהה המשתמש'
            : 'Current user information not found. Please specify email or user ID');
        }
      }

      if (!params.role) {
        throw new Error(practiceContext.language === 'he'
          ? 'תפקיד להסרה נדרש'
          : 'Role to remove is required');
      }

      // Validate role - canonical roles only
      const validRoles = roleModel.CANONICAL_ROLES;
      if (!validRoles.includes(params.role)) {
        throw new Error(practiceContext.language === 'he'
          ? `תפקיד לא תקין. אפשרויות: ${validRoles.join(', ')}`
          : `Invalid role. Options: ${validRoles.join(', ')}`);
      }

      // Get the user data and ID
      let actualUserId;
      let currentUser;
      let currentRoles = [];

      // Import SecureDataAccess for direct database access
      const SecureDataAccess = require('./secureDataAccess');

      // Search for the user - use email if it's an email address
      let searchParams = {};
      if (params.userId.includes('@')) {
        searchParams = { email: params.userId };
      } else {
        searchParams = { searchTerm: params.userId };
      }

      const searchResult = await this.searchUsers(searchParams, practiceContext, session);
      if (!searchResult.data || searchResult.data.length === 0) {
        throw new Error(practiceContext.language === 'he'
          ? `משתמש ${params.userId} לא נמצא`
          : `User ${params.userId} not found`);
      }

      currentUser = searchResult.data[0];
      actualUserId = currentUser._id || currentUser.id;
      currentRoles = currentUser.roles || [];
      console.log(`📝 Found user: ${currentUser.email || params.userId}, ID: ${actualUserId}, Current roles: ${currentRoles.join(', ')}`);

      // Remove the role if present
      if (currentRoles.includes(params.role)) {
        // Don't allow removing the last role
        if (currentRoles.length === 1) {
          throw new Error(practiceContext.language === 'he'
            ? 'לא ניתן להסיר את התפקיד האחרון של המשתמש'
            : 'Cannot remove the last role from a user');
        }

        // Don't allow removing admin role from self
        if (params.role === 'admin' && currentUser.email === practiceContext.user?.email) {
          throw new Error(practiceContext.language === 'he'
            ? 'לא ניתן להסיר הרשאת מנהל מעצמך'
            : 'Cannot remove admin role from yourself');
        }

        currentRoles = currentRoles.filter(r => r !== params.role);
        console.log(`✅ Removing role ${params.role} from user. New roles: ${currentRoles.join(', ')}`);
      } else {
        console.log(`ℹ️ User doesn't have role ${params.role}`);
        return {
          success: true,
          message: practiceContext.language === 'he'
            ? `למשתמש אין את התפקיד ${params.role}`
            : `User doesn't have the ${params.role} role`,
          data: {
            _id: actualUserId,
            email: currentUser.email,
            roles: currentRoles
          }
        };
      }

      // Use SecureDataAccess directly - the agent runs in backend context
      console.log('🔄 Updating user roles directly via SecureDataAccess:', {
        userId: actualUserId,
        practiceSubdomain: practiceContext.practiceSubdomain || practiceContext.subdomain,
        practiceId: practiceContext.practiceId,
        roles: currentRoles
      });

      // Create context for SecureDataAccess
      const context = {
        serviceId: this.serviceName,
        operation: 'remove-user-role',
        practiceId: practiceContext.practiceSubdomain || practiceContext.subdomain || practiceContext.practiceId,
        practiceSubdomain: practiceContext.practiceSubdomain || practiceContext.subdomain,
        apiKey: this.serviceAuth?.apiKey || this.serviceToken
      };

      // If the user no longer holds any clinical (schedulable) role, also remove provider info
      let updateData = { $set: { roles: currentRoles } };
      const providerInfoRemoved = roleModel.isClinicalRole(params.role) && !roleModel.rolesAreClinical(currentRoles);
      if (providerInfoRemoved) {
        console.log('🔄 No clinical role remaining - also removing provider info...');
        updateData.$unset = {
          providerInfo: 1,
          providerSettings: 1,
          appointmentSettings: 1
        };
      }

      // Update the user directly
      const updateResponse = await SecureDataAccess.update(
        'users',
        { _id: actualUserId },
        updateData,
        context
      );

      // SecureDataAccess.update returns the update result directly
      if (updateResponse && (updateResponse.modifiedCount > 0 || updateResponse.matchedCount > 0)) {
        console.log('✅ User roles updated successfully via SecureDataAccess');
        if (providerInfoRemoved) {
          console.log('✅ Provider information also removed');
        }
      } else {
        throw new Error(practiceContext.language === 'he'
          ? 'הסרת התפקיד נכשלה'
          : 'Failed to remove role');
      }

      // Return success with updated user data
      const previousRoles = searchResult.data[0].roles || [];
      return {
        success: true,
        data: {
          _id: actualUserId,
          email: currentUser.email,
          roles: currentRoles
        },
        userId: actualUserId,
        userEmail: currentUser.email,
        message: practiceContext.language === 'he'
          ? providerInfoRemoved
            ? `התפקיד ${params.role} ומידע הספק הוסרו בהצלחה. תפקידים נוכחיים: ${currentRoles.join(', ')}`
            : `התפקיד ${params.role} הוסר בהצלחה. תפקידים נוכחיים: ${currentRoles.join(', ')}`
          : providerInfoRemoved
            ? `Role ${params.role} and provider information removed successfully. Current roles: ${currentRoles.join(', ')}`
            : `Role ${params.role} removed successfully. Current roles: ${currentRoles.join(', ')}`,
        previousRoles: previousRoles,
        currentRoles: currentRoles,
        removedRole: params.role
      };

    } catch (error) {
      console.error('Error removing user role:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he'
          ? `שגיאה בהסרת תפקיד: ${error.message}`
          : `Error removing role: ${error.message}`
      };
    }
  }

async bulkUpdateRoles(params, practiceContext, session) {
    try {
      const isHebrew = session?.language === 'he';
      
      // Validate input
      if (!params.users || !Array.isArray(params.users) || params.users.length === 0) {
        throw new Error(isHebrew ? 'רשימת משתמשים נדרשת' : 'User list required');
      }
      
      if (!params.newRole) {
        throw new Error(isHebrew ? 'תפקיד חדש נדרש' : 'New role required');
      }
      
      const results = {
        success: [],
        failed: [],
        unchanged: [],
        totalProcessed: 0
      };
      
      // Process each user
      for (const userIdentifier of params.users) {
        results.totalProcessed++;
        
        try {
          const result = await this.addUserRole({
            userId: userIdentifier,
            role: params.newRole
          }, practiceContext, session);
          
          if (result.success) {
            if (result.unchanged) {
              results.unchanged.push(userIdentifier);
            } else {
              results.success.push(userIdentifier);
            }
          } else {
            results.failed.push({
              user: userIdentifier,
              error: result.message
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
        ? `סיכום עדכון תפקידים:\n`
        : `Role update summary:\n`;
      
      if (results.success.length > 0) {
        message += isHebrew 
          ? `✅ עודכנו בהצלחה: ${results.success.length}\n`
          : `✅ Successfully updated: ${results.success.length}\n`;
      }
      
      if (results.unchanged.length > 0) {
        message += isHebrew 
          ? `↔️ ללא שינוי: ${results.unchanged.length}\n`
          : `↔️ Unchanged: ${results.unchanged.length}\n`;
      }
      
      if (results.failed.length > 0) {
        message += isHebrew 
          ? `❌ נכשלו: ${results.failed.length}\n`
          : `❌ Failed: ${results.failed.length}\n`;
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
      console.error('Error in bulk role update:', error);
      return {
        success: false,
        message: session?.language === 'he' 
          ? `שגיאה בעדכון תפקידים: ${error.message}`
          : `Error updating roles: ${error.message}`,
        error: error.message
      };
    }
  }

async resendEmailVerification(params, practiceContext, session) {
    try {
      // Validate required fields
      if (!params.email) {
        throw new Error(practiceContext.language === 'he' 
          ? 'כתובת אימייל נדרשת' 
          : 'Email address is required');
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(params.email)) {
        throw new Error(practiceContext.language === 'he' 
          ? 'פורמט אימייל לא תקין' 
          : 'Invalid email format');
      }
      
      // Update emailVerified to false and set a verification token via SecureDataAccess
      const context = this.createSecureContext(practiceContext, 'resend-email-verification');
      const users = await SecureDataAccess.query('users', { email: params.email.toLowerCase() }, { limit: 1 }, context);
      if (!users || users.length === 0) {
        throw new Error(practiceContext.language === 'he'
          ? 'משתמש לא נמצא'
          : 'User not found');
      }

      // Mark email as unverified so verification flow triggers again
      await SecureDataAccess.update('users', { email: params.email.toLowerCase() }, { $set: { emailVerified: false, updatedAt: new Date() } }, context);

      return {
        success: true,
        message: practiceContext.language === 'he'
          ? `אימייל אימות נשלח מחדש לכתובת: ${params.email}`
          : `Email verification resent to: ${params.email}`,
        email: params.email,
        reason: params.reason
      };
      
    } catch (error) {
      console.error('Error resending email verification:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בשליחה מחדש של אימות אימייל: ${error.message}`
          : `Error resending email verification: ${error.message}`
      };
    }
  }

async importUsersFromCSV(params, practiceContext, session) {
    try {
      const { uploadId, fileIndex = 0, mappings } = params;
      
      if (!uploadId) {
        const error = practiceContext.language === 'he' 
          ? 'מזהה העלאה נדרש' 
          : 'Upload ID is required';
        console.error('Import failed - no upload ID', { error });
        throw new Error(error);
      }
      
      console.log(`📊 Importing users from CSV: ${uploadId}, file index: ${fileIndex}`);
      
      // CRITICAL: Only use practice-specific database, NEVER global (security requirement)
      if (!practiceContext.practiceSubdomain && !practiceContext.practiceId) {
        return {
          success: false,
          error: 'NO_CLINIC_CONTEXT',
          message: practiceContext.language === 'he' 
            ? 'לא ניתן לייבא משתמשים ללא הקשר מרפאה'
            : 'Cannot import users without practice context'
        };
      }
      
      // Use subdomain for proper database routing
      const clinicIdentifier = practiceContext.practiceSubdomain || practiceContext.practiceId;
      const context = {
        serviceId: this.serviceName,
        operation: 'importUsersFromCSV',
        practiceId: clinicIdentifier,
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
        encryptedData = file.encryptedPackage;
      } else {
        let dataBuffer;
        
        if (Buffer.isBuffer(file.encryptedContent)) {
          dataBuffer = file.encryptedContent;
        } else if (file.encryptedContent && file.encryptedContent.type === 'Buffer' && Array.isArray(file.encryptedContent.data)) {
          dataBuffer = Buffer.from(file.encryptedContent.data);
        } else if (typeof file.encryptedContent === 'string') {
          dataBuffer = Buffer.from(file.encryptedContent, 'base64');
        } else {
          throw new Error('Invalid encrypted content format');
        }
        
        encryptedData = {
          data: dataBuffer.toString('base64'),
          iv: file.contentIv,
          tag: file.contentTag,
          algorithm: 'aes-256-gcm'
        };
      }
      
      // Decrypt the file
      const decryptedResult = await e2eEncryptionService.decryptDocument(
        pendingUpload.userId,
        encryptedData
      );
      
      const csvContent = decryptedResult.data.toString('utf-8');
      
      // Parse CSV content
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
      
      // Parse headers - handle nested fields like profile.firstName
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      // If no mappings provided, show preview for mapping
      if (!mappings) {
        const preview = [];
        for (let i = 1; i < Math.min(4, lines.length); i++) {
          const values = this.parseCSVLine(lines[i]);
          const record = {};
          headers.forEach((header, index) => {
            record[header] = values[index] || '';
          });
          preview.push(record);
        }
        
        return {
          success: true,
          needsMapping: true,
          headers: headers,
          preview: preview,
          totalRows: lines.length - 1,
          message: practiceContext.language === 'he' 
            ? `נמצאו ${lines.length - 1} משתמשים בקובץ. בדוק את המיפוי ואשר.`
            : `Found ${lines.length - 1} users in file. Please review the mapping and confirm.`,
          suggestedMappings: this.suggestUserFieldMappings(headers)
        };
      }
      
      // Process CSV with mappings
      const results = {
        success: [],
        updated: [],
        failed: [],
        duplicates: []
      };
      
      // Get crypto for password generation
      const crypto = require('crypto');
      const bcrypt = require('bcryptjs');
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const rawRecord = {};
        headers.forEach((header, index) => {
          rawRecord[header] = values[index] || '';
        });
        
        try {
          // Build user object from CSV data
          const userData = {
            email: rawRecord.email || rawRecord.Email || rawRecord.EMAIL,
            isPasswordless: rawRecord.isPasswordless === 'true' || rawRecord.passwordless === 'true' || true, // Default to passwordless
            emailVerified: rawRecord.emailVerified === 'true' || false,
            profile: {
              firstName: rawRecord['profile.firstName'] || rawRecord.firstName || rawRecord.first_name,
              lastName: rawRecord['profile.lastName'] || rawRecord.lastName || rawRecord.last_name,
              title: rawRecord['profile.title'] || rawRecord.title,
              phone: rawRecord['profile.phone'] || rawRecord.phone
            },
            roles: [],
            permissions: [],
            status: rawRecord.status || 'active',
            preferredLanguage: rawRecord.preferredLanguage || practiceContext.language || 'en'
          };
          
          // Parse roles (can be comma-separated), normalized to canonical roles
          const rolesStr = rawRecord.roles || rawRecord.role || '';
          if (rolesStr) {
            userData.roles = roleModel.normalizeRoles(rolesStr.split(',').map(r => r.trim()).filter(r => r));
          }

          // Add provider info if applicable (clinical/schedulable roles only)
          if (roleModel.rolesAreClinical(userData.roles)) {
            userData.providerInfo = {
              providerId: rawRecord['providerInfo.providerId'] || `PROV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              licenseNumber: rawRecord['providerInfo.licenseNumber'] || rawRecord.licenseNumber,
              licenseState: rawRecord['providerInfo.licenseState'] || rawRecord.licenseState,
              departments: [],
              specialties: [],
              appointmentSettings: {
                defaultDuration: 30,
                bufferTime: 0,
                maxDailyAppointments: 30,
                allowDoubleBooking: false,
                allowVideoConsults: true,
                consultationTypes: []
              },
              stats: {
                totalAppointments: 0,
                completedAppointments: 0,
                cancelledAppointments: 0,
                averageRating: 0,
                totalRatings: 0
              }
            };
            
            // Parse specialties
            const specialtiesStr = rawRecord['providerInfo.specialties'] || rawRecord.specialties || rawRecord.specialty || '';
            if (specialtiesStr) {
              userData.providerInfo.specialties = specialtiesStr.split(',').map(s => s.trim()).filter(s => s);
            }
            
            // Parse departments
            const departmentsStr = rawRecord['providerInfo.departments'] || rawRecord.departments || rawRecord.department || '';
            if (departmentsStr) {
              userData.providerInfo.departments = departmentsStr.split(',').map(d => d.trim()).filter(d => d);
            }
            
            // Parse consultation types
            const consultTypesStr = rawRecord['providerInfo.appointmentSettings.consultationTypes'] || rawRecord.consultationTypes || '';
            if (consultTypesStr) {
              userData.providerInfo.appointmentSettings.consultationTypes = consultTypesStr.split(',').map(t => t.trim()).filter(t => t);
            }
            
            // Parse default duration
            const duration = rawRecord['providerInfo.appointmentSettings.defaultDuration'] || rawRecord.appointmentDuration;
            if (duration) {
              userData.providerInfo.appointmentSettings.defaultDuration = parseInt(duration) || 30;
            }
          }
          
          // Validate required fields
          if (!userData.email) {
            throw new Error('Email is required');
          }
          if (!userData.profile.firstName || !userData.profile.lastName) {
            throw new Error('First and last name are required');
          }
          
          // Check if user already exists
          const existingUsers = await SecureDataAccess.query('users', 
            { email: userData.email }, 
            { limit: 1 }, 
            context
          );
          
          if (existingUsers && existingUsers.length > 0) {
            // Update existing user
            const updates = {
              profile: userData.profile,
              roles: userData.roles,
              isPasswordless: userData.isPasswordless,
              emailVerified: userData.emailVerified,
              status: userData.status,
              preferredLanguage: userData.preferredLanguage,
              providerInfo: userData.providerInfo,
              updatedAt: new Date()
            };
            
            await SecureDataAccess.update('users',
              { email: userData.email },
              updates,
              context
            );
            
            results.updated.push({
              email: userData.email,
              name: `${userData.profile.firstName} ${userData.profile.lastName}`,
              role: userData.roles.join(', ')
            });
          } else {
            // Create new user
            userData.practiceSubdomain = clinicIdentifier;
            userData.createdAt = new Date();
            userData.updatedAt = new Date();
            userData.loginAttempts = 0;
            userData.security = {
              mfaEnabled: false,
              mfaSecret: null,
              backupCodes: []
            };
            userData.appointments = {
              asProvider: [],
              created: [],
              favoriteProviders: []
            };
            userData.notificationPreferences = {
              email: true,
              sms: false,
              push: false,
              appointmentReminders: true,
              systemAlerts: true,
              marketingMessages: false
            };
            userData.patientGroupAccess = {
              accessLevel: 'all',
              departments: [],
              assignedPatients: []
            };
            
            // Set permissions based on primary role using the shared method
            const primaryRole = roleModel.primaryRole(userData.roles);
            userData.permissions = this._getDefaultPermissions(primaryRole);
            
            // No password for passwordless users
            if (!userData.isPasswordless) {
              const tempPassword = crypto.randomBytes(16).toString('hex');
              const salt = await bcrypt.genSalt(12);
              userData.password = await bcrypt.hash(tempPassword, salt);
            }
            
            await SecureDataAccess.insert('users', userData, context);
            
            results.success.push({
              email: userData.email,
              name: `${userData.profile.firstName} ${userData.profile.lastName}`,
              role: userData.roles.join(', '),
              providerId: userData.providerInfo?.providerId
            });
          }
          
        } catch (error) {
          console.error(`Failed to import user at row ${i}:`, error);
          results.failed.push({
            row: i,
            email: rawRecord.email || 'unknown',
            error: error.message
          });
        }
      }
      
      // Clean up the pending upload after successful import
      if (results.success.length > 0 || results.updated.length > 0) {
        await SecureDataAccess.delete(
          'pendinguploads',
          { uploadId },
          context
        );
      }
      
      // Log the import results
      console.log('📊 User CSV Import Results:', {
        successful: results.success.length,
        updated: results.updated.length,
        failed: results.failed.length,
        duplicates: results.duplicates.length
      });
      
      // Prepare summary message
      const summary = [];
      if (results.success.length > 0) {
        summary.push(practiceContext.language === 'he' 
          ? `${results.success.length} משתמשים חדשים נוספו`
          : `${results.success.length} new users added`);
      }
      if (results.updated.length > 0) {
        summary.push(practiceContext.language === 'he' 
          ? `${results.updated.length} משתמשים עודכנו`
          : `${results.updated.length} users updated`);
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
          failed: results.failed.length,
          total: lines.length - 1,
          details: results
        },
        message: summary.join(', ')
      };
      
    } catch (error) {
      console.error('Error importing users from CSV:', error);
      return {
        success: false,
        error: error.message,
        message: practiceContext.language === 'he' 
          ? `שגיאה בייבוא משתמשים: ${error.message}`
          : `Error importing users: ${error.message}`
      };
    }
  }

  /**
   * Search users by specialty
   * @param {Object} params - { specialty: string, limit?: number }
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session object
   * @returns {Promise<Object>} { success: boolean, data: Array, message: string }
   */
  async getUsersBySpecialty(params, practiceContext, session) {
    try {
      const { specialty, limit = 50 } = params;

      if (!specialty) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'חובה לציין התמחות'
            : 'Specialty is required'
        };
      }

      const context = {
        serviceId: 'userService',
        operation: 'getUsersBySpecialty',
        practiceId: practiceContext.practiceId,
        userId: practiceContext.userId
      };

      // Query users with the specified specialty
      const users = await SecureDataAccess.query('users', {
        'providerInfo.specialties': specialty,
        status: 'active'
      }, {
        limit: limit,
        select: 'email profile roles providerInfo.specialties providerInfo.licenseNumber providerInfo.departments'
      }, context);

      return {
        success: true,
        data: users,
        message: practiceContext.language === 'he'
          ? `נמצאו ${users.length} רופאים עם התמחות ${specialty}`
          : `Found ${users.length} providers with specialty ${specialty}`
      };
    } catch (error) {
      console.error('Get users by specialty error:', error);
      return {
        success: false,
        message: practiceContext.language === 'he'
          ? `שגיאה בחיפוש רופאים: ${error.message}`
          : `Error searching providers: ${error.message}`
      };
    }
  }

  /**
   * Update user specialties (replace all specialties)
   * @param {Object} params - { userId: string, specialties: Array<string> }
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session object
   * @returns {Promise<Object>} { success: boolean, data: Object, message: string }
   */
  async updateUserSpecialties(params, practiceContext, session) {
    try {
      const { userId, specialties } = params;

      if (!userId || !specialties || !Array.isArray(specialties)) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'חובה לציין מזהה משתמש ורשימת התמחויות'
            : 'User ID and specialties array are required'
        };
      }

      const context = {
        serviceId: 'userService',
        operation: 'updateUserSpecialties',
        practiceId: practiceContext.practiceId,
        userId: practiceContext.userId
      };

      // Get user to verify they're a provider
      const users = await SecureDataAccess.query('users', {
        _id: userId
      }, { limit: 1 }, context);

      const user = users[0];
      if (!user) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'משתמש לא נמצא'
            : 'User not found'
        };
      }

      // Check if user is a provider (clinical/schedulable role)
      const isProvider = roleModel.rolesAreClinical(user.roles);

      if (!isProvider) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'רק ספקים רפואיים יכולים להחזיק התמחויות'
            : 'Only medical providers can have specialties'
        };
      }

      // Update specialties
      const updateData = {
        'providerInfo.specialties': specialties
      };

      await SecureDataAccess.update('users', {
        _id: userId
      }, {
        $set: updateData
      }, context);

      // Get updated user
      const updatedUsers = await SecureDataAccess.query('users', {
        _id: userId
      }, {
        limit: 1,
        select: 'email profile roles providerInfo.specialties'
      }, context);

      return {
        success: true,
        data: updatedUsers[0],
        message: practiceContext.language === 'he'
          ? `התמחויות עודכנו בהצלחה`
          : `Specialties updated successfully`
      };
    } catch (error) {
      console.error('Update user specialties error:', error);
      return {
        success: false,
        message: practiceContext.language === 'he'
          ? `שגיאה בעדכון התמחויות: ${error.message}`
          : `Error updating specialties: ${error.message}`
      };
    }
  }

  /**
   * Add a specialty to user
   * @param {Object} params - { userId: string, specialty: string }
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session object
   * @returns {Promise<Object>} { success: boolean, data: Object, message: string }
   */
  async addUserSpecialty(params, practiceContext, session) {
    try {
      const { userId, specialty } = params;

      if (!userId || !specialty) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'חובה לציין מזהה משתמש והתמחות'
            : 'User ID and specialty are required'
        };
      }

      const context = {
        serviceId: 'userService',
        operation: 'addUserSpecialty',
        practiceId: practiceContext.practiceId,
        userId: practiceContext.userId
      };

      // Get user to verify they're a provider
      const users = await SecureDataAccess.query('users', {
        _id: userId
      }, { limit: 1 }, context);

      const user = users[0];
      if (!user) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'משתמש לא נמצא'
            : 'User not found'
        };
      }

      // Check if user is a provider (clinical/schedulable role)
      const isProvider = roleModel.rolesAreClinical(user.roles);

      if (!isProvider) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'רק ספקים רפואיים יכולים להחזיק התמחויות'
            : 'Only medical providers can have specialties'
        };
      }

      // Check if specialty already exists
      const currentSpecialties = user.providerInfo?.specialties || [];
      if (currentSpecialties.includes(specialty)) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'ההתמחות כבר קיימת'
            : 'Specialty already exists'
        };
      }

      // Add specialty using $addToSet (prevents duplicates)
      await SecureDataAccess.update('users', {
        _id: userId
      }, {
        $addToSet: { 'providerInfo.specialties': specialty }
      }, context);

      // Get updated user
      const updatedUsers = await SecureDataAccess.query('users', {
        _id: userId
      }, {
        limit: 1,
        select: 'email profile roles providerInfo.specialties'
      }, context);

      return {
        success: true,
        data: updatedUsers[0],
        message: practiceContext.language === 'he'
          ? `ההתמחות ${specialty} נוספה בהצלחה`
          : `Specialty ${specialty} added successfully`
      };
    } catch (error) {
      console.error('Add user specialty error:', error);
      return {
        success: false,
        message: practiceContext.language === 'he'
          ? `שגיאה בהוספת התמחות: ${error.message}`
          : `Error adding specialty: ${error.message}`
      };
    }
  }

  /**
   * Remove a specialty from user
   * @param {Object} params - { userId: string, specialty: string }
   * @param {Object} practiceContext - Practice context
   * @param {Object} session - Session object
   * @returns {Promise<Object>} { success: boolean, data: Object, message: string }
   */
  async removeUserSpecialty(params, practiceContext, session) {
    try {
      const { userId, specialty } = params;

      if (!userId || !specialty) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'חובה לציין מזהה משתמש והתמחות'
            : 'User ID and specialty are required'
        };
      }

      const context = {
        serviceId: 'userService',
        operation: 'removeUserSpecialty',
        practiceId: practiceContext.practiceId,
        userId: practiceContext.userId
      };

      // Get user to verify they're a provider
      const users = await SecureDataAccess.query('users', {
        _id: userId
      }, { limit: 1 }, context);

      const user = users[0];
      if (!user) {
        return {
          success: false,
          message: practiceContext.language === 'he'
            ? 'משתמש לא נמצא'
            : 'User not found'
        };
      }

      // Remove specialty using $pull
      await SecureDataAccess.update('users', {
        _id: userId
      }, {
        $pull: { 'providerInfo.specialties': specialty }
      }, context);

      // Get updated user
      const updatedUsers = await SecureDataAccess.query('users', {
        _id: userId
      }, {
        limit: 1,
        select: 'email profile roles providerInfo.specialties'
      }, context);

      return {
        success: true,
        data: updatedUsers[0],
        message: practiceContext.language === 'he'
          ? `ההתמחות ${specialty} הוסרה בהצלחה`
          : `Specialty ${specialty} removed successfully`
      };
    } catch (error) {
      console.error('Remove user specialty error:', error);
      return {
        success: false,
        message: practiceContext.language === 'he'
          ? `שגיאה בהסרת התמחות: ${error.message}`
          : `Error removing specialty: ${error.message}`
      };
    }
  }

}

module.exports = new UserService();
