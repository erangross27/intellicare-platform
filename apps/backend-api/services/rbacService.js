/**
 * 🔐 ROLE-BASED ACCESS CONTROL (RBAC) SERVICE
 * Manages user roles, permissions, and access control for compliance features
 */

const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const immutableAuditService = require('./immutableAuditService');

class RBACService {
  constructor() {
    // Define roles hierarchy.
    // Canonical roles (config/roles.js): admin, doctor, nurse, user.
    // Legacy keys are kept ONLY as inert fallbacks for resolving pre-existing data.
    this.roleHierarchy = {
      // Canonical
      'admin': 10,
      'doctor': 7,
      'nurse': 6,
      'user': 2,
      // Legacy fallbacks (never assigned/offered/displayed)
      'medical_director': 9,
      'compliance_officer': 8,
      'doctor_specialist': 7,
      'nurse_rn': 6,
      'nurse_lpn': 5,
      'lab_tech': 4,
      'secretary': 3,
      'billing': 3,
      'receptionist': 2,
      'patient': 1,
      'guest': 0
    };

    // Initialize permissions, cache, and resource rules
    this.setupPermissions();
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('rbac');
    return this;
  }

  setupPermissions() {
    // Define role permissions
    this.rolePermissions = {
      'admin': [
        'view_all_compliance_data',
        'manage_compliance_settings',
        'export_compliance_reports',
        'manage_access_requests',
        'view_all_disclosures',
        'manage_audit_logs',
        'bypass_access_restrictions',
        'manage_users',
        'system_admin'
      ],
      'medical_director': [
        'view_all_compliance_data',
        'export_compliance_reports',
        'manage_access_requests',
        'view_all_disclosures',
        'view_audit_logs',
        'approve_urgent_requests',
        'override_deadlines'
      ],
      'compliance_officer': [
        'view_all_compliance_data',
        'export_compliance_reports',
        'manage_access_requests',
        'view_all_disclosures',
        'view_audit_logs',
        'track_violations',
        'generate_dashboards',
        'manage_deadlines'
      ],
      'doctor': [
        'view_patient_records',
        'track_disclosures',
        'request_patient_data',
        'view_own_audit_logs',
        'export_patient_reports'
      ],
      // Canonical nurse: registered-nurse style clinical documentation access.
      'nurse': [
        'view_patient_records',
        'track_disclosures',
        'view_own_audit_logs',
        'request_limited_data'
      ],
      // Canonical user: basic, read-only access.
      'user': [
        'view_basic_patient_info',
        'view_own_audit_logs'
      ],
      'doctor_specialist': [
        'view_patient_records',
        'track_disclosures',
        'request_patient_data',
        'view_own_audit_logs',
        'export_patient_reports',
        'access_specialist_data'
      ],
      'nurse_rn': [
        'view_patient_records',
        'track_disclosures',
        'view_own_audit_logs',
        'request_limited_data'
      ],
      'nurse_lpn': [
        'view_limited_patient_records',
        'view_own_audit_logs',
        'request_limited_data'
      ],
      'lab_tech': [
        'view_lab_results',
        'track_lab_disclosures',
        'view_own_audit_logs'
      ],
      'secretary': [
        'create_access_requests',
        'view_request_status',
        'schedule_appointments'
      ],
      'billing': [
        'view_billing_records',
        'track_billing_disclosures',
        'generate_billing_reports'
      ],
      'receptionist': [
        'create_access_requests',
        'view_basic_patient_info'
      ],
      'patient': [
        'view_own_records',
        'request_own_data',
        'view_own_disclosures',
        'download_own_reports'
      ],
      'guest': []
    };

    // Define resource access rules
    this.resourceAccessRules = {
      'compliance_dashboard': {
        requiredRoles: ['admin', 'medical_director', 'compliance_officer'],
        requiredPermissions: ['view_all_compliance_data']
      },
      'phi_access_detection': {
        requiredRoles: ['admin', 'medical_director', 'compliance_officer'],
        requiredPermissions: ['view_all_compliance_data']
      },
      'access_requests': {
        create: {
          requiredRoles: ['*'], // Any authenticated user
          requiredPermissions: []
        },
        manage: {
          requiredRoles: ['admin', 'medical_director', 'compliance_officer'],
          requiredPermissions: ['manage_access_requests']
        },
        view_own: {
          requiredRoles: ['*'],
          requiredPermissions: []
        }
      },
      'disclosures': {
        track: {
          requiredRoles: ['admin', 'doctor', 'nurse_rn', 'medical_director'],
          requiredPermissions: ['track_disclosures']
        },
        view_all: {
          requiredRoles: ['admin', 'compliance_officer', 'medical_director'],
          requiredPermissions: ['view_all_disclosures']
        },
        view_own: {
          requiredRoles: ['patient'],
          requiredPermissions: ['view_own_disclosures']
        }
      },
      'audit_logs': {
        view_all: {
          requiredRoles: ['admin', 'compliance_officer', 'medical_director'],
          requiredPermissions: ['view_audit_logs']
        },
        view_own: {
          requiredRoles: ['*'],
          requiredPermissions: ['view_own_audit_logs']
        },
        manage: {
          requiredRoles: ['admin'],
          requiredPermissions: ['manage_audit_logs']
        }
      }
    };

    // Cache for user permissions
    this.permissionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check if user has required role
   */
  hasRole(user, requiredRole) {
    if (!user || !user.roles) return false;
    
    // Check exact role match
    if (user.roles.includes(requiredRole)) return true;
    
    // Check role hierarchy (higher roles have access to lower role permissions)
    const userHighestRole = this.getUserHighestRole(user);
    const requiredLevel = this.roleHierarchy[requiredRole] || 0;
    const userLevel = this.roleHierarchy[userHighestRole] || 0;
    
    return userLevel >= requiredLevel;
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(user, requiredRoles) {
    if (!user || !user.roles || !requiredRoles || requiredRoles.length === 0) return false;
    
    // Wildcard - any authenticated user
    if (requiredRoles.includes('*')) return true;
    
    return requiredRoles.some(role => this.hasRole(user, role));
  }

  /**
   * Check if user has required permission
   */
  hasPermission(user, requiredPermission) {
    if (!user) return false;
    
    // Check direct permissions
    if (user.permissions && user.permissions.includes(requiredPermission)) return true;
    
    // Check role-based permissions
    const userPermissions = this.getUserPermissions(user);
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Check if user has all required permissions
   */
  hasAllPermissions(user, requiredPermissions) {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    return requiredPermissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * Check if user can access resource
   */
  canAccessResource(user, resource, action = 'view') {
    if (!user || !resource) return false;
    
    // Admin bypass
    if (this.hasRole(user, 'admin')) return true;
    
    // Get resource access rules
    const resourceRules = this.resourceAccessRules[resource];
    if (!resourceRules) return false;
    
    const actionRules = action ? resourceRules[action] : resourceRules;
    if (!actionRules) return false;
    
    // Check roles
    if (actionRules.requiredRoles && !this.hasAnyRole(user, actionRules.requiredRoles)) {
      return false;
    }
    
    // Check permissions
    if (actionRules.requiredPermissions && !this.hasAllPermissions(user, actionRules.requiredPermissions)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get user's highest role based on hierarchy
   */
  getUserHighestRole(user) {
    if (!user || !user.roles) return 'guest';
    
    let highestRole = 'guest';
    let highestLevel = 0;
    
    for (const role of user.roles) {
      const level = this.roleHierarchy[role] || 0;
      if (level > highestLevel) {
        highestLevel = level;
        highestRole = role;
      }
    }
    
    return highestRole;
  }

  /**
   * Get all permissions for user based on roles
   */
  getUserPermissions(user) {
    if (!user) return [];
    
    // Check cache
    const cacheKey = `${user._id || user.id}_permissions`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && cached.timestamp > Date.now() - this.cacheTimeout) {
      return cached.permissions;
    }
    
    // Collect permissions from all roles
    const permissions = new Set();
    
    // Add direct permissions
    if (user.permissions) {
      user.permissions.forEach(p => permissions.add(p));
    }
    
    // Add role-based permissions
    if (user.roles) {
      for (const role of user.roles) {
        const rolePerms = this.rolePermissions[role] || [];
        rolePerms.forEach(p => permissions.add(p));
      }
    }
    
    const permissionArray = Array.from(permissions);
    
    // Update cache
    this.permissionCache.set(cacheKey, {
      permissions: permissionArray,
      timestamp: Date.now()
    });
    
    return permissionArray;
  }

  /**
   * Check data access scope for user
   */
  getDataAccessScope(user, resourceType = 'patient') {
    if (!user) return { level: 'none', filters: {} };
    
    // Admin sees everything
    if (this.hasRole(user, 'admin')) {
      return { level: 'all', filters: {} };
    }
    
    // Medical director sees all in their practice
    if (this.hasRole(user, 'medical_director')) {
      return { level: 'practice', filters: {} };
    }
    
    // Department-based access
    if (user.patientGroupAccess) {
      const { accessLevel, departments, assignedPatients } = user.patientGroupAccess;
      
      switch (accessLevel) {
        case 'all':
          return { level: 'all', filters: {} };
        
        case 'department':
          return {
            level: 'department',
            filters: { department: { $in: departments || [] } }
          };
        
        case 'assigned':
          return {
            level: 'assigned',
            filters: { _id: { $in: assignedPatients || [] } }
          };
        
        default:
          return { level: 'none', filters: { _id: null } };
      }
    }
    
    // Default: users can only see their own data
    if (resourceType === 'patient' && this.hasRole(user, 'patient')) {
      return {
        level: 'own',
        filters: { _id: user._id || user.id }
      };
    }
    
    return { level: 'none', filters: { _id: null } };
  }

  /**
   * Validate access request
   */
  async validateAccessRequest(user, request, action = 'view') {
    const validation = {
      allowed: false,
      reason: '',
      requiredApprovals: []
    };
    
    // Check if user can perform action on access requests
    if (!this.canAccessResource(user, 'access_requests', action)) {
      validation.reason = {
        he: 'אין לך הרשאה לבצע פעולה זו',
        en: 'You do not have permission to perform this action'
      };
      return validation;
    }
    
    // Check specific request access
    if (action === 'view' || action === 'view_own') {
      // Users can view their own requests
      if (request.requesterId === (user._id || user.id).toString()) {
        validation.allowed = true;
        return validation;
      }
      
      // Admins and compliance officers can view all
      if (this.hasAnyRole(user, ['admin', 'compliance_officer', 'medical_director'])) {
        validation.allowed = true;
        return validation;
      }
      
      validation.reason = {
        he: 'אינך מורשה לצפות בבקשה זו',
        en: 'You are not authorized to view this request'
      };
      return validation;
    }
    
    // Processing requests requires special permissions
    if (action === 'process' || action === 'manage') {
      if (!this.hasPermission(user, 'manage_access_requests')) {
        validation.reason = {
          he: 'אין לך הרשאה לעבד בקשות גישה',
          en: 'You do not have permission to process access requests'
        };
        return validation;
      }
      
      // Check if urgent requests need special approval
      if (request.urgency === 'urgent' && !this.hasPermission(user, 'approve_urgent_requests')) {
        validation.requiredApprovals.push('medical_director');
        validation.reason = {
          he: 'בקשות דחופות דורשות אישור מנהל רפואי',
          en: 'Urgent requests require medical director approval'
        };
        return validation;
      }
      
      validation.allowed = true;
      return validation;
    }
    
    validation.allowed = true;
    return validation;
  }

  /**
   * Log permission check for audit
   */
  async logPermissionCheck(user, resource, action, result) {
    try {
      await immutableAuditService.addAuditEntry({
        eventType: 'permission_check',
        userId: user._id || user.id || 'unknown',
        details: `Permission check for ${resource}:${action}`,
        metadata: {
          resource,
          action,
          result,
          userRoles: user.roles || [],
          userPermissions: this.getUserPermissions(user),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to log permission check:', error);
    }
  }

  /**
   * Grant temporary permission
   */
  async grantTemporaryPermission(user, permission, duration = 3600000) {
    const tempPermission = {
      userId: user._id || user.id,
      permission,
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + duration),
      grantedBy: 'system'
    };
    
    // In production, store in database
    // For now, add to user's permissions temporarily
    if (!user.permissions) user.permissions = [];
    user.permissions.push(permission);
    
    // Log the grant
    await immutableAuditService.addAuditEntry({
      eventType: 'permission_granted',
      userId: tempPermission.userId,
      details: `Temporary permission granted: ${permission}`,
      metadata: tempPermission
    });
    
    // Schedule removal
    setTimeout(() => {
      const index = user.permissions.indexOf(permission);
      if (index > -1) {
        user.permissions.splice(index, 1);
      }
    }, duration);
    
    return tempPermission;
  }

  /**
   * Check if user needs additional training
   */
  checkTrainingRequirements(user, resource) {
    const trainingRequirements = {
      'compliance_dashboard': ['hipaa_training', 'privacy_training'],
      'phi_access_detection': ['advanced_privacy_training'],
      'access_requests': ['patient_rights_training'],
      'disclosures': ['disclosure_training']
    };
    
    const requiredTraining = trainingRequirements[resource] || [];
    const userTraining = user.completedTraining || [];
    
    const missingTraining = requiredTraining.filter(t => !userTraining.includes(t));
    
    return {
      requiresTraining: missingTraining.length > 0,
      missingTraining,
      message: missingTraining.length > 0 ? {
        he: `נדרשת הכשרה: ${missingTraining.join(', ')}`,
        en: `Training required: ${missingTraining.join(', ')}`
      } : null
    };
  }

  /**
   * Get user's access summary
   */
  getUserAccessSummary(user) {
    if (!user) return null;
    
    return {
      userId: user._id || user.id,
      email: user.email,
      roles: user.roles || [],
      highestRole: this.getUserHighestRole(user),
      permissions: this.getUserPermissions(user),
      dataAccessScope: this.getDataAccessScope(user),
      resources: {
        complianceDashboard: this.canAccessResource(user, 'compliance_dashboard'),
        phiAccessDetection: this.canAccessResource(user, 'phi_access_detection'),
        accessRequests: {
          create: this.canAccessResource(user, 'access_requests', 'create'),
          manage: this.canAccessResource(user, 'access_requests', 'manage'),
          viewOwn: this.canAccessResource(user, 'access_requests', 'view_own')
        },
        disclosures: {
          track: this.canAccessResource(user, 'disclosures', 'track'),
          viewAll: this.canAccessResource(user, 'disclosures', 'view_all'),
          viewOwn: this.canAccessResource(user, 'disclosures', 'view_own')
        },
        auditLogs: {
          viewAll: this.canAccessResource(user, 'audit_logs', 'view_all'),
          viewOwn: this.canAccessResource(user, 'audit_logs', 'view_own'),
          manage: this.canAccessResource(user, 'audit_logs', 'manage')
        }
      }
    };
  }
}

// Singleton instance
const rbacService = new RBACService();

module.exports = rbacService;