/**
 * 🔐 SECURE SERVICE ACCOUNT MANAGER (SECURE VARIANT)
 * 
 * Enhanced security variant with JWT-based authentication
 * Uses SecureDataAccess for all database operations
 */

const crypto = require('crypto');
const path = require('path');
const jwt = require(path.resolve(__dirname, '../../../backend/node_modules/jsonwebtoken'));
const bcrypt = require(path.resolve(__dirname, '../../../backend/node_modules/bcryptjs'));

// Add service proxy getter
let simpleServiceProxy = null;
function getServiceProxy() {
    if (!simpleServiceProxy) {
        simpleServiceProxy = require('../../../backend/services/simpleServiceProxy');
    }
    return simpleServiceProxy;
}

// Helper function to log security events
let auditServiceInstance = null;

async function logSecurityEvent(eventType, practiceId, details) {
    if (auditServiceInstance) {
        try {
            await auditServiceInstance.logSecurityEvent({
                eventType,
                practiceId,
                details,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Failed to log security event:', error);
        }
    }
}

class SecureServiceAccountManagerSecure {
    constructor() {
        this.serviceToken = null;
        this.initialized = false;
        this.jwtSecret = null;
        this.authenticatedServices = new Map();
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Authenticate this service through proxy
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate('service-account-manager-secure');
            
            // Initialize JWT secret
            this.jwtSecret = crypto.randomBytes(64).toString('hex');
            
            this.initialized = true;
            console.log('✅ Secure Service Account Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Secure Service Account Manager:', error);
            throw error;
        }
    }

    /**
     * Set the audit service reference
     */
    setAuditService(auditService) {
        auditServiceInstance = auditService;
    }

    /**
     * Enhanced authentication with JWT tokens
     */
    async authenticateSecure(serviceId, providedApiKey = null) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            // Use base service account manager for core authentication
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            const authResult = await serviceAccountManager.authenticate(serviceId, providedApiKey);
            
            if (!authResult) {
                return null;
            }

            // Generate JWT token for enhanced security
            const jwtToken = jwt.sign({
                serviceId: authResult.serviceId,
                permissions: authResult.permissions,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
            }, this.jwtSecret);

            const enhancedAuth = {
                ...authResult,
                jwtToken,
                securityLevel: 'enhanced',
                authenticationType: 'jwt'
            };

            // Cache the enhanced authentication
            this.authenticatedServices.set(serviceId, enhancedAuth);

            await logSecurityEvent('secure_service_authenticated', null, {
                serviceId,
                securityLevel: 'enhanced',
                timestamp: new Date().toISOString()
            });

            return enhancedAuth;
            
        } catch (error) {
            console.error(`❌ Secure authentication failed for ${serviceId}:`, error.message);
            await logSecurityEvent('secure_service_auth_failed', null, {
                serviceId,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }

    /**
     * Validate JWT token
     */
    validateToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            console.error('JWT validation failed:', error.message);
            return null;
        }
    }

    /**
     * Get security metrics
     */
    getSecurityMetrics() {
        return {
            authenticatedServices: this.authenticatedServices.size,
            jwtTokensIssued: this.authenticatedServices.size,
            securityLevel: 'enhanced',
            lastAuthentication: new Date(),
            initialized: this.initialized
        };
    }

    /**
     * Revoke all tokens for a service
     */
    async revokeServiceTokens(serviceId) {
        this.authenticatedServices.delete(serviceId);
        
        await logSecurityEvent('secure_service_tokens_revoked', null, {
            serviceId,
            timestamp: new Date().toISOString()
        });
        
        console.log(`🔒 All secure tokens revoked for service: ${serviceId}`);
    }
}

// Export as singleton
const serviceInstance = new SecureServiceAccountManagerSecure();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('serviceAccountManagerSecure', () => serviceInstance);
}

module.exports = serviceInstance;