/**
 * Patient Portal Access Module
 * 
 * Manages patient portal access, authentication, permissions, and security features
 * for the patient portal system.
 * 
 * Features:
 * - Portal account creation and activation
 * - Access permissions and role management
 * - Session management and security
 * - Feature access control
 * - Login attempt monitoring and security
 */

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

const crypto = require('crypto');

class PatientPortalAccess {
    constructor() {
        this.serviceName = 'PatientPortalAccess';
        this.serviceToken = null;
        this.initialized = false;
        this.accessLevels = {
            BASIC: 'basic',
            STANDARD: 'standard',
            PREMIUM: 'premium',
            RESTRICTED: 'restricted'
        };
        this.portalFeatures = {
            VIEW_RECORDS: 'view_records',
            VIEW_TEST_RESULTS: 'view_test_results',
            SCHEDULE_APPOINTMENTS: 'schedule_appointments',
            MESSAGING: 'messaging',
            BILLING: 'billing',
            PRESCRIPTION_REFILLS: 'prescription_refills',
            FAMILY_ACCESS: 'family_access'
        };
    }

    async initialize() {
        if (this.initialized) return;
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
        this.initialized = true;
    }

    /**
     * Create patient portal account
     */
    async createPortalAccount(params, practiceContext) {
        await this.initialize();

        const validation = this.validatePortalAccountData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { patientId, email, accessLevel, features } = validation.processedData;

        try {
            // Check if portal account already exists
            const existingAccount = await this.getPortalAccount(patientId, practiceContext);
            if (existingAccount) {
                throw new Error('Portal account already exists for this patient');
            }

            // Generate activation token
            const activationToken = crypto.randomBytes(32).toString('hex');
            const activationExpiry = new Date();
            activationExpiry.setHours(activationExpiry.getHours() + 24); // 24-hour expiry

            const portalAccount = {
                patientId,
                email,
                accessLevel: accessLevel || this.accessLevels.STANDARD,
                features: features || this.getDefaultFeatures(accessLevel),
                status: 'pending_activation',
                activationToken,
                activationExpiry,
                loginAttempts: 0,
                lastLogin: null,
                createdAt: new Date(),
                createdBy: params.userId,
                securitySettings: {
                    twoFactorEnabled: false,
                    passwordResetRequired: false,
                    sessionTimeoutMinutes: 30
                }
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'createPortalAccount',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const createdAccount = await SecureDataAccess.create('patient_portal_accounts', portalAccount, context);

            // Send activation email
            await this.sendActivationEmail(email, activationToken, practiceContext);

            // Audit trail
            await this.auditPortalAction('CREATE_PORTAL_ACCOUNT', {
                patientId,
                email,
                accessLevel,
                userId: params.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                accountId: createdAccount._id,
                activationToken,
                message: 'Portal account created successfully. Activation email sent.'
            };

        } catch (error) {
            console.error(`Error creating portal account:`, error);
            throw new Error(`Failed to create portal account: ${error.message}`);
        }
    }

    /**
     * Activate patient portal account
     */
    async activatePortalAccount(params, practiceContext) {
        await this.initialize();

        const { activationToken, tempPassword } = params;

        if (!activationToken || !tempPassword) {
            throw new Error('Activation token and temporary password are required');
        }

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'activatePortalAccount',
                practiceId: practiceContext.practiceId
            };

            // Find account by activation token
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const account = await SecureDataAccess.query('patient_portal_accounts', {
                activationToken,
                status: 'pending_activation',
                activationExpiry: { $gt: new Date() }
            }, {}, context);

            if (!account || account.length === 0) {
                throw new Error('Invalid or expired activation token');
            }

            const portalAccount = account[0];

            // Validate password strength
            if (!this.validatePasswordStrength(tempPassword)) {
                throw new Error('Password does not meet security requirements');
            }

            // Hash password
            const bcrypt = require('bcrypt');
            const passwordHash = await bcrypt.hash(tempPassword, 10);

            // Activate account
            await SecureDataAccess.update('patient_portal_accounts',
                { _id: portalAccount._id },
                {
                    status: 'active',
                    passwordHash,
                    activationToken: null,
                    activationExpiry: null,
                    activatedAt: new Date()
                },
                context
            );

            // Audit trail
            await this.auditPortalAction('ACTIVATE_PORTAL_ACCOUNT', {
                patientId: portalAccount.patientId,
                accountId: portalAccount._id,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                message: 'Portal account activated successfully'
            };

        } catch (error) {
            console.error(`Error activating portal account:`, error);
            throw new Error(`Failed to activate portal account: ${error.message}`);
        }
    }

    /**
     * Update portal access permissions
     */
    async updatePortalPermissions(params, practiceContext) {
        await this.initialize();

        const validation = this.validatePermissionData(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { patientId, accessLevel, features, securitySettings } = validation.processedData;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'updatePortalPermissions',
                practiceId: practiceContext.practiceId
            };

            const updateData = {
                updatedAt: new Date(),
                updatedBy: params.userId
            };

            if (accessLevel) {
                updateData.accessLevel = accessLevel;
            }

            if (features) {
                updateData.features = features;
            }

            if (securitySettings) {
                updateData.securitySettings = { ...updateData.securitySettings, ...securitySettings };
            }

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.update('patient_portal_accounts',
                { patientId },
                updateData,
                context
            );

            // Audit trail
            await this.auditPortalAction('UPDATE_PORTAL_PERMISSIONS', {
                patientId,
                changes: updateData,
                userId: params.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                message: 'Portal permissions updated successfully'
            };

        } catch (error) {
            console.error(`Error updating portal permissions:`, error);
            throw new Error(`Failed to update portal permissions: ${error.message}`);
        }
    }

    /**
     * Get portal account information
     */
    async getPortalAccount(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPortalAccount',
            practiceId: practiceContext.practiceId
        };

        try {
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const accounts = await SecureDataAccess.query('patient_portal_accounts', 
                { patientId }, {}, context);

            if (accounts && accounts.length > 0) {
                const account = accounts[0];
                // Remove sensitive data
                delete account.passwordHash;
                delete account.activationToken;
                return account;
            }

            return null;

        } catch (error) {
            console.error(`Error getting portal account:`, error);
            throw new Error(`Failed to get portal account: ${error.message}`);
        }
    }

    /**
     * Check feature access for patient
     */
    async checkFeatureAccess(patientId, feature, practiceContext) {
        await this.initialize();

        try {
            const account = await this.getPortalAccount(patientId, practiceContext);
            
            if (!account || account.status !== 'active') {
                return {
                    hasAccess: false,
                    reason: 'Account not active or not found'
                };
            }

            const hasFeature = account.features && account.features.includes(feature);
            
            return {
                hasAccess: hasFeature,
                accessLevel: account.accessLevel,
                reason: hasFeature ? 'Access granted' : 'Feature not enabled for this account'
            };

        } catch (error) {
            console.error(`Error checking feature access:`, error);
            return {
                hasAccess: false,
                reason: 'Error checking access permissions'
            };
        }
    }

    /**
     * Record login attempt
     */
    async recordLoginAttempt(params, practiceContext) {
        await this.initialize();

        const { patientId, success, ipAddress, userAgent } = params;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'recordLoginAttempt',
                practiceId: practiceContext.practiceId
            };

            // Update login attempts counter
            const updateData = success ? {
                loginAttempts: 0,
                lastLogin: new Date(),
                lastLoginIP: ipAddress
            } : {
                $inc: { loginAttempts: 1 },
                lastFailedLogin: new Date(),
                lastFailedIP: ipAddress
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.update('patient_portal_accounts',
                { patientId },
                updateData,
                context
            );

            // Create login log entry
            const loginLog = {
                patientId,
                success,
                ipAddress,
                userAgent,
                timestamp: new Date(),
                practiceId: practiceContext.practiceId
            };

            await SecureDataAccess.create('patient_portal_login_log', loginLog, context);

            // Check if account should be locked
            if (!success) {
                await this.checkAccountLocking(patientId, practiceContext);
            }

            return {
                success: true,
                message: 'Login attempt recorded'
            };

        } catch (error) {
            console.error(`Error recording login attempt:`, error);
            throw new Error(`Failed to record login attempt: ${error.message}`);
        }
    }

    /**
     * Check if account should be locked due to failed attempts
     */
    async checkAccountLocking(patientId, practiceContext) {
        const account = await this.getPortalAccount(patientId, practiceContext);
        const maxAttempts = 5;
        
        if (account && account.loginAttempts >= maxAttempts) {
            const context = {
                serviceId: this.serviceName,
                operation: 'lockAccount',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.update('patient_portal_accounts',
                { patientId },
                {
                    status: 'locked',
                    lockedAt: new Date(),
                    lockReason: 'Too many failed login attempts'
                },
                context
            );

            // Audit trail
            await this.auditPortalAction('LOCK_ACCOUNT', {
                patientId,
                reason: 'Too many failed login attempts',
                attempts: account.loginAttempts,
                practiceId: practiceContext.practiceId
            });
        }
    }

    /**
     * Get default features for access level
     */
    getDefaultFeatures(accessLevel) {
        const featureSets = {
            [this.accessLevels.BASIC]: [
                this.portalFeatures.VIEW_RECORDS
            ],
            [this.accessLevels.STANDARD]: [
                this.portalFeatures.VIEW_RECORDS,
                this.portalFeatures.VIEW_TEST_RESULTS,
                this.portalFeatures.SCHEDULE_APPOINTMENTS,
                this.portalFeatures.MESSAGING
            ],
            [this.accessLevels.PREMIUM]: [
                this.portalFeatures.VIEW_RECORDS,
                this.portalFeatures.VIEW_TEST_RESULTS,
                this.portalFeatures.SCHEDULE_APPOINTMENTS,
                this.portalFeatures.MESSAGING,
                this.portalFeatures.BILLING,
                this.portalFeatures.PRESCRIPTION_REFILLS,
                this.portalFeatures.FAMILY_ACCESS
            ],
            [this.accessLevels.RESTRICTED]: []
        };

        return featureSets[accessLevel] || featureSets[this.accessLevels.STANDARD];
    }

    /**
     * Validation methods
     */
    validatePortalAccountData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.email || !this.isValidEmail(data.email)) {
            errors.push('Valid email address is required');
        } else {
            processedData.email = data.email.toLowerCase();
        }

        if (data.accessLevel && !Object.values(this.accessLevels).includes(data.accessLevel)) {
            errors.push('Invalid access level');
        } else {
            processedData.accessLevel = data.accessLevel;
        }

        processedData.features = data.features;

        return { success: errors.length === 0, errors, processedData };
    }

    validatePermissionData(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (data.accessLevel && !Object.values(this.accessLevels).includes(data.accessLevel)) {
            errors.push('Invalid access level');
        } else if (data.accessLevel) {
            processedData.accessLevel = data.accessLevel;
        }

        if (data.features && Array.isArray(data.features)) {
            const invalidFeatures = data.features.filter(f => !Object.values(this.portalFeatures).includes(f));
            if (invalidFeatures.length > 0) {
                errors.push(`Invalid features: ${invalidFeatures.join(', ')}`);
            } else {
                processedData.features = data.features;
            }
        }

        processedData.securitySettings = data.securitySettings;

        return { success: errors.length === 0, errors, processedData };
    }

    validatePasswordStrength(password) {
        return password && 
               password.length >= 8 && 
               /[A-Z]/.test(password) && 
               /[a-z]/.test(password) && 
               /[0-9]/.test(password) && 
               /[^A-Za-z0-9]/.test(password);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    async sendActivationEmail(email, token, practiceContext) {
        // Integration with email service would go here
        console.log(`Sending activation email to ${email} with token ${token}`);
    }

    async auditPortalAction(action, details) {
        const auditEntry = {
            timestamp: new Date(),
            service: this.serviceName,
            action,
            details,
            success: true
        };
        console.log('Audit:', auditEntry);
    }
}

// Create and export singleton
const patientPortalAccess = new PatientPortalAccess();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('patientPortalAccess', () => patientPortalAccess);
}

module.exports = patientPortalAccess;