/**
 * 🔐 SERVICE AUTHENTICATION MIDDLEWARE
 * 
 * This middleware validates service tokens on EVERY request from background services.
 * It blocks all unauthorized service operations and injects service context.
 * 
 * SECURITY: All background services MUST authenticate through this middleware.
 * Direct database access without a valid service token is PROHIBITED.
 */

const serviceAccountManager = require('../services/serviceAccountManager');
const immutableAuditService = require('../services/immutableAuditService');

// Helper function to log security events
async function logSecurityEvent(eventType, practiceId, details) {
    try {
        await immutableAuditService.logSecurityEvent({
            eventType,
            practiceId,
            details,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to log security event:', error);
    }
}

/**
 * Middleware to authenticate service accounts
 */
const authenticateService = async (req, res, next) => {
    try {
        // Extract service token from headers
        const serviceToken = req.headers['x-service-token'] || 
                           req.headers['authorization']?.replace('Service ', '');
        
        if (!serviceToken) {
            // Check if this is a regular user request (not a service)
            if (req.user || req.headers['authorization']?.startsWith('Bearer ')) {
                // Regular user request, not a service request
                return next();
            }
            
            // Service request without token - BLOCKED
            await logSecurityEvent('service_auth_blocked', req.practiceId, {
                reason: 'Missing service token',
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(401).json({
                error: {
                    he: 'נדרש אימות שירות. השירות חייב להזדהות עם טוקן תקף',
                    en: 'Service authentication required. Service must authenticate with valid token'
                },
                code: 'SERVICE_AUTH_REQUIRED'
            });
        }

        // Validate the service token
        const tokenPayload = serviceAccountManager.validateToken(serviceToken);
        
        if (!tokenPayload) {
            await logSecurityEvent('service_auth_invalid', req.practiceId, {
                reason: 'Invalid or expired token',
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(401).json({
                error: {
                    he: 'טוקן שירות לא תקף או פג תוקף. יש לחדש את האימות',
                    en: 'Invalid or expired service token. Please re-authenticate'
                },
                code: 'SERVICE_TOKEN_INVALID'
            });
        }

        // Check if service is authorized for this operation
        const operation = `${req.method}:${req.baseUrl}${req.path}`;
        const practiceId = req.practiceId || req.params.practiceId || req.body?.practiceId;
        
        if (practiceId && !serviceAccountManager.isAuthorized(
            tokenPayload.serviceId, 
            operation, 
            practiceId
        )) {
            await logSecurityEvent('service_auth_unauthorized', practiceId, {
                serviceId: tokenPayload.serviceId,
                operation,
                reason: 'Service not authorized for this operation/practice',
                endpoint: req.originalUrl
            });
            
            return res.status(403).json({
                error: {
                    he: 'השירות אינו מורשה לבצע פעולה זו',
                    en: 'Service is not authorized for this operation'
                },
                code: 'SERVICE_UNAUTHORIZED'
            });
        }

        // Inject service context into request
        req.serviceContext = {
            serviceId: tokenPayload.serviceId,
            permissions: tokenPayload.permissions,
            allowedClinics: tokenPayload.allowedClinics,
            isServiceAccount: true,
            tokenIssuedAt: new Date(tokenPayload.issuedAt),
            tokenExpiresAt: new Date(tokenPayload.expiresAt)
        };

        // Log successful service authentication
        await immutableAuditService.logServiceOperation({
            serviceId: tokenPayload.serviceId,
            operation,
            practiceId,
            endpoint: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString(),
            success: true
        });

        next();
    } catch (error) {
        console.error('Service authentication error:', error);
        
        await logSecurityEvent('service_auth_error', req.practiceId, {
            error: error.message,
            endpoint: req.originalUrl,
            method: req.method
        });
        
        res.status(500).json({
            error: {
                he: 'שגיאה באימות השירות',
                en: 'Service authentication error'
            },
            code: 'SERVICE_AUTH_ERROR'
        });
    }
};

/**
 * Middleware to require service authentication for specific routes
 */
const requireServiceAuth = async (req, res, next) => {
    // This middleware REQUIRES service authentication
    const serviceToken = req.headers['x-service-token'] || 
                       req.headers['authorization']?.replace('Service ', '');
    
    if (!serviceToken) {
        await logSecurityEvent('service_auth_required_missing', req.practiceId, {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip
        });
        
        return res.status(401).json({
            error: {
                he: 'נדרש אימות שירות לגישה לנתיב זה',
                en: 'Service authentication required for this endpoint'
            },
            code: 'SERVICE_AUTH_MANDATORY',
            hint: 'Use serviceAccountManager.authenticate() to get a valid token'
        });
    }

    // Validate the token
    const tokenPayload = serviceAccountManager.validateToken(serviceToken);
    
    if (!tokenPayload) {
        return res.status(401).json({
            error: {
                he: 'טוקן שירות לא תקף',
                en: 'Invalid service token'
            },
            code: 'SERVICE_TOKEN_INVALID'
        });
    }

    // Ensure service context exists
    if (!req.serviceContext) {
        req.serviceContext = {
            serviceId: tokenPayload.serviceId,
            permissions: tokenPayload.permissions,
            allowedClinics: tokenPayload.allowedClinics,
            isServiceAccount: true,
            tokenIssuedAt: new Date(tokenPayload.issuedAt),
            tokenExpiresAt: new Date(tokenPayload.expiresAt)
        };
    }

    next();
};

/**
 * Helper to check if request is from a service account
 */
const isServiceRequest = (req) => {
    return req.serviceContext?.isServiceAccount === true;
};

/**
 * Helper to get service ID from request
 */
const getServiceId = (req) => {
    return req.serviceContext?.serviceId || null;
};

/**
 * Middleware to log service data access
 */
const logServiceDataAccess = async (req, res, next) => {
    if (!isServiceRequest(req)) {
        return next();
    }

    const serviceId = getServiceId(req);
    const startTime = Date.now();
    
    // Capture response data
    const originalSend = res.send;
    res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // Log data access asynchronously
        setImmediate(async () => {
            try {
                await immutableAuditService.logServiceDataAccess({
                    serviceId,
                    endpoint: req.originalUrl,
                    method: req.method,
                    practiceId: req.practiceId,
                    dataAccessed: {
                        type: req.baseUrl.split('/')[2], // Extract resource type
                        count: Array.isArray(data) ? data.length : 1
                    },
                    responseTime,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Failed to log service data access:', error);
            }
        });
        
        return originalSend.call(this, data);
    };
    
    next();
};

/**
 * Validate service permissions for specific operations
 */
const requireServicePermission = (permission) => {
    return async (req, res, next) => {
        if (!isServiceRequest(req)) {
            return res.status(403).json({
                error: {
                    he: 'רק שירותי רקע יכולים לגשת לנתיב זה',
                    en: 'Only background services can access this endpoint'
                },
                code: 'SERVICE_ONLY_ENDPOINT'
            });
        }

        const serviceContext = req.serviceContext;
        const hasPermission = serviceContext.permissions.includes(permission) ||
                            serviceContext.permissions.includes('*');
        
        if (!hasPermission) {
            await logSecurityEvent('service_permission_denied', req.practiceId, {
                serviceId: serviceContext.serviceId,
                requiredPermission: permission,
                servicePermissions: serviceContext.permissions,
                endpoint: req.originalUrl
            });
            
            return res.status(403).json({
                error: {
                    he: `השירות אינו מורשה לבצע פעולה: ${permission}`,
                    en: `Service lacks required permission: ${permission}`
                },
                code: 'INSUFFICIENT_SERVICE_PERMISSIONS'
            });
        }

        next();
    };
};

/**
 * Validate service can access specific practice
 */
const requireClinicAccess = async (req, res, next) => {
    if (!isServiceRequest(req)) {
        return next();
    }

    const serviceContext = req.serviceContext;
    const practiceId = req.practiceId || req.params.practiceId || req.body?.practiceId;
    
    if (!practiceId) {
        return next();
    }

    const hasAccess = serviceContext.allowedClinics.includes('*') ||
                     serviceContext.allowedClinics.includes(practiceId);
    
    if (!hasAccess) {
        await logSecurityEvent('service_practice_access_denied', practiceId, {
            serviceId: serviceContext.serviceId,
            attemptedClinic: practiceId,
            allowedClinics: serviceContext.allowedClinics,
            endpoint: req.originalUrl
        });
        
        return res.status(403).json({
            error: {
                he: 'השירות אינו מורשה לגשת למרפאה זו',
                en: 'Service is not authorized to access this practice'
            },
            code: 'CLINIC_ACCESS_DENIED'
        });
    }

    next();
};

module.exports = {
    authenticateService,
    requireServiceAuth,
    requireServicePermission,
    requireClinicAccess,
    logServiceDataAccess,
    isServiceRequest,
    getServiceId
};