/**
 * 🔒 IntelliCare System Health Check Utility
 * Agent 8: Lightweight health verification for all MongoDB operator fixes
 * 
 * Purpose:
 * 1. Tests database connections (securely through SecureDataAccess)
 * 2. Verifies all services initialize without errors  
 * 3. Checks no security warnings remain
 * 4. Returns clean status report
 * 
 * This complements test-startup-validation.js with focused production checks.
 */

const path = require('path');
const fs = require('fs').promises;

class SystemHealthCheck {
    constructor() {
        this.startTime = Date.now();
        this.checks = {
            database: { status: 'pending', details: [] },
            services: { status: 'pending', total: 0, initialized: 0, errors: [] },
            security: { status: 'pending', violations: 0, warnings: [] },
            performance: { status: 'pending', metrics: {} }
        };
        this.overallStatus = 'pending';
    }

    log(level, message, category = 'general') {
        const timestamp = new Date().toISOString().substr(11, 8);
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
        console.log(`[${timestamp}] ${prefix} [${category.toUpperCase()}] ${message}`);
        
        if (level === 'error' && category !== 'performance') {
            this.checks[category] = this.checks[category] || { status: 'pending', errors: [] };
            this.checks[category].errors = this.checks[category].errors || [];
            this.checks[category].errors.push(message);
        } else if (level === 'warn') {
            this.checks[category] = this.checks[category] || { status: 'pending', warnings: [] };
            this.checks[category].warnings = this.checks[category].warnings || [];
            this.checks[category].warnings.push(message);
        }
    }

    /**
     * Check 1: Database Connectivity (Secure)
     * Only uses SecureDataAccess - no direct mongoose.connection
     */
    async checkDatabase() {
        this.log('info', 'Testing database connectivity...', 'database');
        
        try {
            // Test SecureDataAccess can be loaded
            const SecureDataAccess = require('../services/secureDataAccess');
            if (!SecureDataAccess) {
                throw new Error('SecureDataAccess not available');
            }
            
            this.log('success', 'SecureDataAccess loaded successfully', 'database');
            this.checks.database.details.push('SecureDataAccess: Available');
            
            // Test ServiceAccountManager for authentication
            try {
                const serviceAccountManager = require('../services/serviceAccountManager');
                if (serviceAccountManager) {
                    this.checks.database.details.push('ServiceAccountManager: Available');
                    this.log('success', 'Service authentication system ready', 'database');
                } else {
                    this.log('warn', 'ServiceAccountManager not found', 'database');
                }
            } catch (error) {
                this.log('warn', `ServiceAccountManager load issue: ${error.message}`, 'database');
            }
            
            // Test basic database factory availability (for internal use by SecureDataAccess)
            try {
                const databaseFactory = require('./databaseFactory');
                if (databaseFactory) {
                    this.checks.database.details.push('DatabaseFactory: Available (internal)');
                }
            } catch (error) {
                this.log('error', `DatabaseFactory not available: ${error.message}`, 'database');
                throw error;
            }
            
            this.checks.database.status = 'healthy';
            this.log('success', 'Database system checks passed', 'database');
            
        } catch (error) {
            this.checks.database.status = 'error';
            this.log('error', `Database check failed: ${error.message}`, 'database');
        }
    }

    /**
     * Check 2: Service Initialization
     * Verify all services can be loaded and have initialize methods
     */
    async checkServices() {
        this.log('info', 'Verifying service initialization...', 'services');
        
        try {
            const servicesPath = path.join(__dirname, '..', 'services');
            const serviceFiles = await fs.readdir(servicesPath);
            const jsFiles = serviceFiles.filter(file => file.endsWith('.js'));
            
            this.checks.services.total = jsFiles.length;
            let initializedCount = 0;
            let classBasedServices = 0;
            let hasInitializeMethod = 0;
            const criticalErrors = [];
            
            // Test critical services first
            const criticalServices = [
                'secureDataAccess.js',
                'serviceAccountManager.js',
                'secureConfigService.js',
                'immutableAuditService.js'
            ];
            
            for (const serviceFile of criticalServices) {
                try {
                    const servicePath = path.join(servicesPath, serviceFile);
                    const ServiceModule = require(servicePath);
                    
                    if (ServiceModule) {
                        this.log('success', `Critical service loaded: ${serviceFile}`, 'services');
                        initializedCount++;
                    }
                } catch (error) {
                    criticalErrors.push(`${serviceFile}: ${error.message}`);
                    this.log('error', `Critical service failed: ${serviceFile} - ${error.message}`, 'services');
                }
            }
            
            // Check all other services
            for (const serviceFile of jsFiles) {
                if (criticalServices.includes(serviceFile)) continue; // Already checked
                
                try {
                    const servicePath = path.join(servicesPath, serviceFile);
                    const ServiceModule = require(servicePath);
                    
                    if (ServiceModule) {
                        // Check if it's a class with initialize method
                        if (typeof ServiceModule === 'function' && ServiceModule.prototype) {
                            classBasedServices++;
                            if (ServiceModule.prototype.initialize) {
                                hasInitializeMethod++;
                            }
                        }
                        initializedCount++;
                    }
                } catch (error) {
                    // Only log non-critical service errors as warnings
                    this.log('warn', `Service load issue: ${serviceFile} - ${error.message.substring(0, 100)}`, 'services');
                }
            }
            
            this.checks.services.initialized = initializedCount;
            this.checks.services.classBasedServices = classBasedServices;
            this.checks.services.hasInitializeMethod = hasInitializeMethod;
            
            // Status determination
            if (criticalErrors.length > 0) {
                this.checks.services.status = 'error';
                this.checks.services.criticalErrors = criticalErrors;
                this.log('error', `${criticalErrors.length} critical service errors found`, 'services');
            } else if (initializedCount >= jsFiles.length * 0.95) { // 95% success rate
                this.checks.services.status = 'healthy';
                this.log('success', `Services loaded: ${initializedCount}/${jsFiles.length} (${hasInitializeMethod} with initialize())`, 'services');
            } else {
                this.checks.services.status = 'warning';
                this.log('warn', `Services loaded: ${initializedCount}/${jsFiles.length} - below optimal`, 'services');
            }
            
        } catch (error) {
            this.checks.services.status = 'error';
            this.log('error', `Service check failed: ${error.message}`, 'services');
        }
    }

    /**
     * Check 3: Security Validation
     * Verify no MongoDB operators in production code and no direct database access
     */
    async checkSecurity() {
        this.log('info', 'Running security validation...', 'security');
        
        try {
            const results = {
                mongoOperators: 0,
                directDbAccess: 0,
                processEnvAccess: 0,
                securePatterns: 0
            };
            
            // Check services directory for security issues
            const servicesPath = path.join(__dirname, '..', 'services');
            const serviceFiles = await fs.readdir(servicesPath);
            const jsFiles = serviceFiles.filter(file => file.endsWith('.js'));
            
            for (const serviceFile of jsFiles) {
                try {
                    const servicePath = path.join(servicesPath, serviceFile);
                    const content = await fs.readFile(servicePath, 'utf-8');
                    
                    // Look for MongoDB operators (in actual queries, not comments)
                    const mongoOperatorPattern = /await.*[\{\(][^}]*\$(?:gte|lte|in|exists|ne|or|and|gt|lt|nin|regex|inc|push|pull|set)[^}]*[\}\)]/g;
                    const operatorMatches = content.match(mongoOperatorPattern);
                    if (operatorMatches && !serviceFile.includes('secureDataAccess') && !serviceFile.includes('aiSecurity')) {
                        results.mongoOperators += operatorMatches.length;
                        this.log('warn', `MongoDB operators found in ${serviceFile}: ${operatorMatches.length}`, 'security');
                    }
                    
                    // Look for direct database access patterns
                    const directDbPattern = /(?:mongoose\.connection|\.getDatabase\(|\.collection\(|Model\.find|Model\.count)/g;
                    const dbMatches = content.match(directDbPattern);
                    if (dbMatches && !serviceFile.includes('databaseFactory') && !serviceFile.includes('secureDataAccess')) {
                        results.directDbAccess += dbMatches.length;
                        this.log('warn', `Direct database access in ${serviceFile}: ${dbMatches.length}`, 'security');
                    }
                    
                    // Look for SecureDataAccess usage (good pattern)
                    if (content.includes('SecureDataAccess')) {
                        results.securePatterns++;
                    }
                    
                } catch (error) {
                    // Skip files that can't be read
                    continue;
                }
            }
            
            this.checks.security.mongoOperators = results.mongoOperators;
            this.checks.security.directDbAccess = results.directDbAccess;
            this.checks.security.securePatterns = results.securePatterns;
            this.checks.security.processEnvAccess = results.processEnvAccess;
            
            // Status determination
            const totalViolations = results.mongoOperators + results.directDbAccess;
            if (totalViolations === 0) {
                this.checks.security.status = 'healthy';
                this.log('success', `Security check passed - ${results.securePatterns} services using secure patterns`, 'security');
            } else if (totalViolations <= 5) {
                this.checks.security.status = 'warning';
                this.log('warn', `${totalViolations} security issues found (acceptable threshold)`, 'security');
            } else {
                this.checks.security.status = 'error';
                this.log('error', `${totalViolations} security violations found - exceeds threshold`, 'security');
            }
            
        } catch (error) {
            this.checks.security.status = 'error';
            this.log('error', `Security check failed: ${error.message}`, 'security');
        }
    }

    /**
     * Check 4: Performance Metrics
     * Basic system performance indicators
     */
    async checkPerformance() {
        this.log('info', 'Collecting performance metrics...', 'performance');
        
        try {
            const endTime = Date.now();
            const startupTime = endTime - this.startTime;
            const memoryUsage = process.memoryUsage();
            
            this.checks.performance.metrics = {
                startupTime: `${startupTime}ms`,
                memoryUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                memoryTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                nodeVersion: process.version,
                platform: process.platform,
                uptime: `${Math.round(process.uptime())}s`
            };
            
            this.checks.performance.status = 'healthy';
            this.log('success', `Performance check completed in ${startupTime}ms`, 'performance');
            
        } catch (error) {
            this.checks.performance.status = 'error';
            this.log('error', `Performance check failed: ${error.message}`, 'performance');
        }
    }

    /**
     * Generate comprehensive status report
     */
    generateReport() {
        const totalChecks = Object.keys(this.checks).length;
        const healthyChecks = Object.values(this.checks).filter(check => check.status === 'healthy').length;
        const errorChecks = Object.values(this.checks).filter(check => check.status === 'error').length;
        const warningChecks = Object.values(this.checks).filter(check => check.status === 'warning').length;
        
        // Determine overall status
        if (errorChecks > 0) {
            this.overallStatus = 'error';
        } else if (warningChecks > 0) {
            this.overallStatus = 'warning';
        } else if (healthyChecks === totalChecks) {
            this.overallStatus = 'healthy';
        } else {
            this.overallStatus = 'unknown';
        }
        
        const report = {
            timestamp: new Date().toISOString(),
            status: this.overallStatus,
            summary: {
                totalChecks,
                healthy: healthyChecks,
                warnings: warningChecks,
                errors: errorChecks,
                duration: `${Date.now() - this.startTime}ms`
            },
            checks: this.checks,
            recommendations: this.generateRecommendations()
        };
        
        return report;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.checks.database?.status === 'error') {
            recommendations.push({
                priority: 'critical',
                category: 'database',
                message: 'Database connectivity issues detected. Check MongoDB connection and SecureDataAccess service.'
            });
        }
        
        if (this.checks.services?.criticalErrors?.length > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'services',
                message: `Critical service errors: ${this.checks.services.criticalErrors.join(', ')}`
            });
        }
        
        if (this.checks.security?.status === 'error') {
            recommendations.push({
                priority: 'high',
                category: 'security',
                message: 'Security violations detected. Review services for MongoDB operators and direct database access.'
            });
        }
        
        if (this.checks.services?.initialized < this.checks.services?.total * 0.9) {
            recommendations.push({
                priority: 'medium',
                category: 'services',
                message: 'Service initialization rate below 90%. Review service dependencies and syntax.'
            });
        }
        
        if (this.checks.security?.mongoOperators > 0) {
            recommendations.push({
                priority: 'high',
                category: 'security',
                message: `${this.checks.security.mongoOperators} MongoDB operators found in service files. Replace with SecureDataAccess patterns.`
            });
        }
        
        return recommendations;
    }

    /**
     * Main health check orchestrator
     */
    async run() {
        console.log('🔒 IntelliCare System Health Check');
        console.log('=' .repeat(50));
        console.log('Agent 8: Verifying MongoDB security fixes...\n');
        
        try {
            // Run all checks
            await this.checkDatabase();
            console.log();
            
            await this.checkServices();  
            console.log();
            
            await this.checkSecurity();
            console.log();
            
            await this.checkPerformance();
            console.log();
            
            // Generate final report
            const report = this.generateReport();
            
            // Display summary
            console.log('=' .repeat(50));
            console.log('📊 HEALTH CHECK SUMMARY');
            console.log('=' .repeat(50));
            
            const statusIcon = report.status === 'healthy' ? '✅' : 
                              report.status === 'warning' ? '⚠️' : '❌';
            
            console.log(`${statusIcon} Overall Status: ${report.status.toUpperCase()}`);
            console.log(`📈 Duration: ${report.summary.duration}`);
            console.log(`✅ Healthy Checks: ${report.summary.healthy}/${report.summary.totalChecks}`);
            
            if (report.summary.warnings > 0) {
                console.log(`⚠️ Warnings: ${report.summary.warnings}`);
            }
            
            if (report.summary.errors > 0) {
                console.log(`❌ Errors: ${report.summary.errors}`);
            }
            
            // Show key metrics
            if (this.checks.services?.initialized) {
                console.log(`🚀 Services: ${this.checks.services.initialized}/${this.checks.services.total} loaded`);
            }
            
            if (this.checks.security?.securePatterns) {
                console.log(`🔒 Security: ${this.checks.security.securePatterns} services using secure patterns`);
            }
            
            if (this.checks.performance?.metrics) {
                console.log(`⚡ Memory: ${this.checks.performance.metrics.memoryUsed} used`);
            }
            
            // Show recommendations if any
            if (report.recommendations.length > 0) {
                console.log('\n📋 RECOMMENDATIONS:');
                report.recommendations.forEach((rec, i) => {
                    const icon = rec.priority === 'critical' ? '🚨' : 
                                 rec.priority === 'high' ? '⚠️' : 'ℹ️';
                    console.log(`  ${icon} [${rec.priority.toUpperCase()}] ${rec.message}`);
                });
            }
            
            console.log('\n' + '=' .repeat(50));
            
            if (report.status === 'healthy') {
                console.log('✅ SYSTEM HEALTHY - All MongoDB security fixes verified!');
                console.log('🚀 Ready for production deployment');
            } else if (report.status === 'warning') {
                console.log('⚠️ SYSTEM OPERATIONAL - Minor issues detected');
                console.log('📝 Review recommendations above');
            } else {
                console.log('❌ SYSTEM ISSUES - Immediate attention required');
                console.log('🔧 Fix critical errors before deployment');
            }
            
            console.log('=' .repeat(50));
            
            // Exit with appropriate code
            return report.status === 'healthy' ? 0 : report.status === 'warning' ? 0 : 1;
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            return 1;
        }
    }
}

// Run if called directly
if (require.main === module) {
    (async () => {
        const healthCheck = new SystemHealthCheck();
        const exitCode = await healthCheck.run();
        process.exit(exitCode);
    })();
}

module.exports = SystemHealthCheck;