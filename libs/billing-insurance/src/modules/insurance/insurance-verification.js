/**
 * Insurance Verification Module
 * 
 * Handles insurance policy verification, eligibility checking, and coverage validation
 * for patients across different insurance providers.
 * 
 * Features:
 * - Real-time insurance verification
 * - Policy eligibility checking
 * - Coverage validation for services
 * - Provider network verification
 * - Multi-payer support (Israel healthcare, private insurance)
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class InsuranceVerification {
    constructor() {
        this.serviceName = 'InsuranceVerification';
        this.serviceToken = null;
        this.initialized = false;
        this.supportedProviders = {
            CLALIT: 'clalit',
            MACCABI: 'maccabi', 
            MEUHEDET: 'meuhedet',
            LEUMIT: 'leumit',
            PRIVATE: 'private',
            INTERNATIONAL: 'international'
        };
        this.verificationTypes = {
            ELIGIBILITY: 'eligibility',
            COVERAGE: 'coverage',
            AUTHORIZATION: 'authorization',
            BENEFITS: 'benefits'
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
     * Verify patient insurance coverage
     */
    async verifyInsurance(params, practiceContext) {
        await this.initialize();

        const validation = this.validateVerificationRequest(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { patientId, insuranceProvider, policyNumber, serviceType } = validation.processedData;

        try {
            // Get patient details for verification
            const patient = await this.getPatientDetails(patientId, practiceContext);
            if (!patient) {
                throw new Error('Patient not found');
            }

            // Perform verification based on provider type
            let verificationResult;
            if (this.isIsraeliProvider(insuranceProvider)) {
                verificationResult = await this.verifyIsraeliInsurance(params, patient, practiceContext);
            } else {
                verificationResult = await this.verifyPrivateInsurance(params, patient, practiceContext);
            }

            // Store verification result
            const verificationRecord = {
                patientId,
                insuranceProvider,
                policyNumber,
                serviceType,
                verified: verificationResult.verified,
                verificationDate: new Date(),
                expiryDate: verificationResult.expiryDate,
                coverage: verificationResult.coverage,
                copayAmount: verificationResult.copayAmount,
                deductibleAmount: verificationResult.deductibleAmount,
                verifiedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'verifyInsurance',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('insurance_verifications', verificationRecord, context);

            // Audit trail
            await this.auditVerificationAction('VERIFY_INSURANCE', {
                patientId,
                insuranceProvider,
                verified: verificationResult.verified,
                serviceType,
                userId: practiceContext.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                verified: verificationResult.verified,
                coverage: verificationResult.coverage,
                copayAmount: verificationResult.copayAmount,
                deductibleAmount: verificationResult.deductibleAmount,
                expiryDate: verificationResult.expiryDate,
                message: practiceContext.language === 'he' 
                    ? (verificationResult.verified ? 'הביטוח אומת בהצלחה' : 'הביטוח לא אומת')
                    : (verificationResult.verified ? 'Insurance verified successfully' : 'Insurance verification failed')
            };

        } catch (error) {
            console.error(`Error verifying insurance:`, error);
            throw new Error(`Failed to verify insurance: ${error.message}`);
        }
    }

    /**
     * Check eligibility for specific service
     */
    async checkServiceEligibility(params, practiceContext) {
        await this.initialize();

        const { patientId, serviceCode, serviceDate, insuranceProvider } = params;

        try {
            const context = {
                serviceId: this.serviceName,
                operation: 'checkServiceEligibility',
                practiceId: practiceContext.practiceId
            };

            // Get latest verification for patient
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const latestVerification = await SecureDataAccess.query('insurance_verifications',
                { patientId, insuranceProvider },
                { sort: { verificationDate: -1 }, limit: 1 },
                context
            );

            if (!latestVerification || latestVerification.length === 0) {
                throw new Error('No insurance verification found for patient');
            }

            const verification = latestVerification[0];

            // Check if verification is still valid
            if (verification.expiryDate && new Date() > new Date(verification.expiryDate)) {
                return {
                    eligible: false,
                    reason: 'Insurance verification expired - please reverify',
                    requiresReverification: true
                };
            }

            // Check service coverage
            const eligibilityResult = await this.checkServiceCoverage(
                serviceCode, 
                verification.coverage, 
                serviceDate
            );

            // Log eligibility check  
            await SecureDataAccess.create('eligibility_checks', {
                patientId,
                serviceCode,
                serviceDate,
                insuranceProvider,
                eligible: eligibilityResult.eligible,
                coveragePercentage: eligibilityResult.coveragePercentage,
                estimatedCopay: eligibilityResult.estimatedCopay,
                checkedAt: new Date(),
                checkedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId
            }, context);

            return {
                success: true,
                eligible: eligibilityResult.eligible,
                coveragePercentage: eligibilityResult.coveragePercentage,
                estimatedCopay: eligibilityResult.estimatedCopay,
                requiresAuthorization: eligibilityResult.requiresAuthorization,
                message: eligibilityResult.message
            };

        } catch (error) {
            console.error(`Error checking service eligibility:`, error);
            throw new Error(`Failed to check service eligibility: ${error.message}`);
        }
    }

    /**
     * Get patient insurance details
     */
    async getPatientInsuranceDetails(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientInsuranceDetails',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get all verification records for patient
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const verifications = await SecureDataAccess.query('insurance_verifications',
                { patientId },
                { sort: { verificationDate: -1 } },
                context
            );

            // Get active policies
            const activePolicies = verifications.filter(v => 
                v.verified && 
                (!v.expiryDate || new Date() <= new Date(v.expiryDate))
            );

            return {
                success: true,
                activePolicies,
                totalVerifications: verifications.length,
                lastVerified: verifications.length > 0 ? verifications[0].verificationDate : null
            };

        } catch (error) {
            console.error(`Error getting patient insurance details:`, error);
            throw new Error(`Failed to get patient insurance details: ${error.message}`);
        }
    }

    /**
     * Verify Israeli healthcare insurance
     */
    async verifyIsraeliInsurance(params, patient, practiceContext) {
        const { insuranceProvider, policyNumber } = params;

        // Simulate Israeli healthcare verification
        // In production, this would call actual Israeli healthcare APIs
        const verificationData = {
            verified: true,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            coverage: {
                primaryCare: { covered: true, copay: 0 },
                specialist: { covered: true, copay: 29 },
                emergency: { covered: true, copay: 0 },
                hospitalization: { covered: true, copay: 0 },
                medications: { covered: true, copay: 'variable' },
                tests: { covered: true, copay: 0 }
            },
            copayAmount: 0,
            deductibleAmount: 0
        };

        return verificationData;
    }

    /**
     * Verify private insurance
     */
    async verifyPrivateInsurance(params, patient, practiceContext) {
        const { insuranceProvider, policyNumber } = params;

        // Simulate private insurance verification
        // In production, this would call actual insurance company APIs
        const verificationData = {
            verified: true,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            coverage: {
                primaryCare: { covered: true, copay: 50 },
                specialist: { covered: true, copay: 100 },
                emergency: { covered: true, copay: 200 },
                hospitalization: { covered: true, copay: 500 },
                medications: { covered: true, copay: 20 },
                tests: { covered: true, copay: 30 }
            },
            copayAmount: 50,
            deductibleAmount: 1000
        };

        return verificationData;
    }

    /**
     * Check service coverage against policy
     */
    async checkServiceCoverage(serviceCode, coverage, serviceDate) {
        // Service coverage logic
        const serviceCategories = {
            'CONSULT': 'primaryCare',
            'SPECIALIST': 'specialist',
            'LAB': 'tests',
            'IMAGING': 'tests',
            'EMERGENCY': 'emergency'
        };

        const category = serviceCategories[serviceCode] || 'primaryCare';
        const serviceCoverage = coverage[category];

        if (!serviceCoverage || !serviceCoverage.covered) {
            return {
                eligible: false,
                message: 'Service not covered by insurance policy'
            };
        }

        return {
            eligible: true,
            coveragePercentage: 80, // Default coverage
            estimatedCopay: serviceCoverage.copay || 0,
            requiresAuthorization: category === 'specialist',
            message: 'Service is covered by insurance policy'
        };
    }

    /**
     * Helper methods
     */
    isIsraeliProvider(provider) {
        return [
            this.supportedProviders.CLALIT,
            this.supportedProviders.MACCABI,
            this.supportedProviders.MEUHEDET,
            this.supportedProviders.LEUMIT
        ].includes(provider);
    }

    async getPatientDetails(patientId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getPatientDetails',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const patients = await SecureDataAccess.query('patients', { _id: patientId }, {}, context);
        return patients && patients.length > 0 ? patients[0] : null;
    }

    /**
     * Validation methods
     */
    validateVerificationRequest(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.insuranceProvider) {
            errors.push('Insurance provider is required');
        } else if (!Object.values(this.supportedProviders).includes(data.insuranceProvider)) {
            errors.push('Unsupported insurance provider');
        } else {
            processedData.insuranceProvider = data.insuranceProvider;
        }

        if (!data.policyNumber) {
            errors.push('Policy number is required');
        } else {
            processedData.policyNumber = data.policyNumber;
        }

        processedData.serviceType = data.serviceType || 'general';

        return { success: errors.length === 0, errors, processedData };
    }

    async auditVerificationAction(action, details) {
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

// Create instance
const insuranceVerification = new InsuranceVerification();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('insuranceVerificationService', () => insuranceVerification);
}

module.exports = insuranceVerification;