/**
 * Insurance Eligibility Module
 * 
 * Handles real-time insurance eligibility verification, member status checking,
 * and coverage validation for healthcare services.
 * 
 * Features:
 * - Real-time eligibility verification
 * - Member enrollment status checking
 * - Plan information retrieval
 * - Coverage effective dates validation
 * - Primary/secondary insurance coordination
 * - Eligibility history tracking
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
    if (!serviceProxyManager) {
        serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
    }
    return serviceProxyManager;
}

class InsuranceEligibility {
    constructor() {
        this.serviceName = 'InsuranceEligibility';
        this.serviceToken = null;
        this.initialized = false;
        this.eligibilityStatuses = {
            ACTIVE: 'active',
            INACTIVE: 'inactive',
            TERMINATED: 'terminated',
            PENDING: 'pending',
            SUSPENDED: 'suspended',
            UNKNOWN: 'unknown'
        };
        this.memberTypes = {
            SUBSCRIBER: 'subscriber',
            SPOUSE: 'spouse',
            DEPENDENT: 'dependent',
            DOMESTIC_PARTNER: 'domestic_partner'
        };
        this.planTypes = {
            HMO: 'hmo',
            PPO: 'ppo',
            EPO: 'epo',
            POS: 'pos',
            HDHP: 'hdhp',
            INDEMNITY: 'indemnity'
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
     * Verify insurance eligibility
     */
    async verifyEligibility(params, practiceContext) {
        await this.initialize();

        const validation = this.validateEligibilityRequest(params);
        if (!validation.success) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }

        const { 
            patientId, 
            insuranceProvider, 
            memberId, 
            dateOfBirth,
            serviceDate,
            subscriberInfo 
        } = validation.processedData;

        try {
            // Perform eligibility verification
            const eligibilityResponse = await this.performEligibilityCheck(
                insuranceProvider,
                memberId,
                dateOfBirth,
                serviceDate,
                subscriberInfo
            );

            // Process and validate response
            const processedEligibility = await this.processEligibilityResponse(
                eligibilityResponse,
                patientId,
                practiceContext
            );

            // Store eligibility verification
            const verificationRecord = {
                verificationId: this.generateVerificationId(),
                patientId,
                insuranceProvider,
                memberId,
                serviceDate: new Date(serviceDate),
                verificationDate: new Date(),
                verifiedBy: practiceContext.userId,
                practiceId: practiceContext.practiceId,
                eligibilityStatus: processedEligibility.status,
                memberInfo: processedEligibility.memberInfo,
                planInfo: processedEligibility.planInfo,
                coverageInfo: processedEligibility.coverageInfo,
                coordinationOfBenefits: processedEligibility.coordinationOfBenefits,
                rawResponse: eligibilityResponse,
                expirationDate: this.calculateVerificationExpiration()
            };

            const context = {
                serviceId: this.serviceName,
                operation: 'verifyEligibility',
                practiceId: practiceContext.practiceId
            };

            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            await SecureDataAccess.create('eligibility_verifications', verificationRecord, context);

            // Update patient insurance information if needed
            if (processedEligibility.status === this.eligibilityStatuses.ACTIVE) {
                await this.updatePatientInsurance(patientId, processedEligibility, practiceContext);
            }

            // Audit trail
            await this.auditEligibilityAction('VERIFY_ELIGIBILITY', {
                verificationId: verificationRecord.verificationId,
                patientId,
                insuranceProvider,
                eligibilityStatus: processedEligibility.status,
                userId: practiceContext.userId,
                practiceId: practiceContext.practiceId
            });

            return {
                success: true,
                verificationId: verificationRecord.verificationId,
                eligibilityStatus: processedEligibility.status,
                memberInfo: processedEligibility.memberInfo,
                planInfo: processedEligibility.planInfo,
                coverageInfo: processedEligibility.coverageInfo,
                coordinationOfBenefits: processedEligibility.coordinationOfBenefits,
                verificationExpiration: verificationRecord.expirationDate,
                message: this.getEligibilityMessage(processedEligibility.status, practiceContext.language)
            };

        } catch (error) {
            console.error(`Error verifying eligibility:`, error);
            throw new Error(`Failed to verify eligibility: ${error.message}`);
        }
    }

    /**
     * Check member enrollment status
     */
    async checkEnrollmentStatus(params, practiceContext) {
        await this.initialize();

        const { patientId, insuranceProvider, checkDate } = params;

        if (!patientId || !insuranceProvider) {
            throw new Error('Patient ID and insurance provider are required');
        }

        try {
            // Get latest eligibility verification
            const latestVerification = await this.getLatestVerification(patientId, insuranceProvider, practiceContext);
            
            if (!latestVerification) {
                return {
                    success: true,
                    enrollmentStatus: this.eligibilityStatuses.UNKNOWN,
                    message: 'No eligibility verification on file',
                    recommendation: 'Verify eligibility before providing services'
                };
            }

            // Check if verification is still valid
            const isValid = new Date() <= new Date(latestVerification.expirationDate);
            
            if (!isValid) {
                return {
                    success: true,
                    enrollmentStatus: this.eligibilityStatuses.UNKNOWN,
                    message: 'Eligibility verification has expired',
                    recommendation: 'Re-verify eligibility',
                    lastVerified: latestVerification.verificationDate
                };
            }

            // Check enrollment status for specific date
            const enrollmentStatus = await this.validateEnrollmentForDate(
                latestVerification,
                checkDate || new Date()
            );

            return {
                success: true,
                enrollmentStatus: enrollmentStatus.status,
                effectiveDate: enrollmentStatus.effectiveDate,
                terminationDate: enrollmentStatus.terminationDate,
                memberType: latestVerification.memberInfo?.memberType,
                planName: latestVerification.planInfo?.planName,
                lastVerified: latestVerification.verificationDate,
                message: this.getEnrollmentStatusMessage(enrollmentStatus.status, practiceContext.language)
            };

        } catch (error) {
            console.error(`Error checking enrollment status:`, error);
            throw new Error(`Failed to check enrollment status: ${error.message}`);
        }
    }

    /**
     * Get comprehensive eligibility summary
     */
    async getEligibilitySummary(patientId, practiceContext) {
        await this.initialize();

        const context = {
            serviceId: this.serviceName,
            operation: 'getEligibilitySummary',
            practiceId: practiceContext.practiceId
        };

        try {
            // Get all eligibility verifications for patient
            const proxy = getServiceProxy();
            const SecureDataAccess = proxy.getService('secureDataAccess');
            const verifications = await SecureDataAccess.query('eligibility_verifications',
                { patientId },
                { sort: { verificationDate: -1 } },
                context
            );

            if (!verifications || verifications.length === 0) {
                return {
                    success: true,
                    hasVerifications: false,
                    message: 'No eligibility verifications on file'
                };
            }

            // Group by insurance provider
            const providerSummary = {};
            
            verifications.forEach(verification => {
                const provider = verification.insuranceProvider;
                if (!providerSummary[provider]) {
                    providerSummary[provider] = {
                        latestVerification: null,
                        verificationHistory: [],
                        currentStatus: this.eligibilityStatuses.UNKNOWN
                    };
                }

                providerSummary[provider].verificationHistory.push(verification);
                
                // Update latest verification if this is more recent
                if (!providerSummary[provider].latestVerification || 
                    new Date(verification.verificationDate) > 
                    new Date(providerSummary[provider].latestVerification.verificationDate)) {
                    providerSummary[provider].latestVerification = verification;
                    providerSummary[provider].currentStatus = verification.eligibilityStatus;
                }
            });

            // Determine primary insurance
            const primaryInsurance = this.identifyPrimaryInsurance(providerSummary);

            // Calculate overall eligibility status
            const overallStatus = this.calculateOverallStatus(providerSummary);

            return {
                success: true,
                hasVerifications: true,
                overallStatus,
                primaryInsurance,
                insuranceProviders: Object.keys(providerSummary),
                providerSummary,
                totalVerifications: verifications.length,
                lastVerificationDate: verifications[0].verificationDate
            };

        } catch (error) {
            console.error(`Error getting eligibility summary:`, error);
            throw new Error(`Failed to get eligibility summary: ${error.message}`);
        }
    }

    /**
     * Validate coordination of benefits
     */
    async validateCoordinationOfBenefits(patientId, practiceContext) {
        await this.initialize();

        try {
            // Get all active eligibility verifications for patient
            const activeVerifications = await this.getActiveVerifications(patientId, practiceContext);

            if (activeVerifications.length <= 1) {
                return {
                    success: true,
                    hasMultipleInsurance: false,
                    coordinationRequired: false,
                    message: 'Patient has single or no active insurance coverage'
                };
            }

            // Analyze coordination of benefits
            const cobAnalysis = await this.analyzeCoordinationOfBenefits(activeVerifications);

            return {
                success: true,
                hasMultipleInsurance: true,
                coordinationRequired: true,
                primaryInsurance: cobAnalysis.primary,
                secondaryInsurance: cobAnalysis.secondary,
                coordinationRules: cobAnalysis.rules,
                recommendations: cobAnalysis.recommendations
            };

        } catch (error) {
            console.error(`Error validating coordination of benefits:`, error);
            throw new Error(`Failed to validate coordination of benefits: ${error.message}`);
        }
    }

    /**
     * Helper methods
     */
    async performEligibilityCheck(insuranceProvider, memberId, dateOfBirth, serviceDate, subscriberInfo) {
        // Simulate eligibility check - in production this would call actual insurance APIs
        const eligibilityResponse = {
            transactionId: `ELG-${Date.now()}`,
            responseCode: '00', // Success
            eligibilityStatus: this.eligibilityStatuses.ACTIVE,
            member: {
                memberId,
                firstName: subscriberInfo?.firstName || 'John',
                lastName: subscriberInfo?.lastName || 'Doe',
                dateOfBirth,
                memberType: this.memberTypes.SUBSCRIBER,
                effectiveDate: '2024-01-01',
                terminationDate: null
            },
            plan: {
                planId: 'PLAN001',
                planName: 'Standard Health Plan',
                planType: this.planTypes.PPO,
                groupNumber: 'GRP12345',
                networkId: 'NET001'
            },
            coverage: {
                medical: {
                    active: true,
                    effectiveDate: '2024-01-01',
                    deductible: { individual: 1000, family: 3000 },
                    outOfPocketMax: { individual: 5000, family: 15000 }
                },
                pharmacy: {
                    active: true,
                    effectiveDate: '2024-01-01',
                    formulary: 'STANDARD'
                }
            },
            coordinationOfBenefits: {
                hasOtherInsurance: false,
                isPrimary: true
            }
        };

        return eligibilityResponse;
    }

    async processEligibilityResponse(response, patientId, practiceContext) {
        return {
            status: response.eligibilityStatus,
            memberInfo: {
                memberId: response.member.memberId,
                firstName: response.member.firstName,
                lastName: response.member.lastName,
                dateOfBirth: response.member.dateOfBirth,
                memberType: response.member.memberType,
                effectiveDate: response.member.effectiveDate,
                terminationDate: response.member.terminationDate
            },
            planInfo: {
                planId: response.plan.planId,
                planName: response.plan.planName,
                planType: response.plan.planType,
                groupNumber: response.plan.groupNumber,
                networkId: response.plan.networkId
            },
            coverageInfo: response.coverage,
            coordinationOfBenefits: response.coordinationOfBenefits
        };
    }

    generateVerificationId() {
        return `ELG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    calculateVerificationExpiration() {
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + 30); // 30-day validity
        return expiration;
    }

    async getLatestVerification(patientId, insuranceProvider, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getLatestVerification',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const verifications = await SecureDataAccess.query('eligibility_verifications',
            { patientId, insuranceProvider },
            { sort: { verificationDate: -1 }, limit: 1 },
            context
        );

        return verifications && verifications.length > 0 ? verifications[0] : null;
    }

    async validateEnrollmentForDate(verification, checkDate) {
        const effectiveDate = new Date(verification.memberInfo.effectiveDate);
        const terminationDate = verification.memberInfo.terminationDate ? 
            new Date(verification.memberInfo.terminationDate) : null;
        const checkDateTime = new Date(checkDate);

        let status = this.eligibilityStatuses.INACTIVE;

        if (checkDateTime >= effectiveDate) {
            if (!terminationDate || checkDateTime <= terminationDate) {
                status = this.eligibilityStatuses.ACTIVE;
            } else {
                status = this.eligibilityStatuses.TERMINATED;
            }
        }

        return {
            status,
            effectiveDate: verification.memberInfo.effectiveDate,
            terminationDate: verification.memberInfo.terminationDate
        };
    }

    async getActiveVerifications(patientId, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'getActiveVerifications',
            practiceId: practiceContext.practiceId
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        const verifications = await SecureDataAccess.query('eligibility_verifications',
            { 
                patientId,
                eligibilityStatus: this.eligibilityStatuses.ACTIVE,
                expirationDate: { $gt: new Date() }
            },
            { sort: { verificationDate: -1 } },
            context
        );

        return verifications || [];
    }

    identifyPrimaryInsurance(providerSummary) {
        // Simple logic - in production this would be more sophisticated
        const activeProviders = Object.entries(providerSummary)
            .filter(([_, summary]) => summary.currentStatus === this.eligibilityStatuses.ACTIVE);

        if (activeProviders.length === 0) return null;

        // Return the first active provider as primary (simplified logic)
        return {
            provider: activeProviders[0][0],
            verification: activeProviders[0][1].latestVerification
        };
    }

    calculateOverallStatus(providerSummary) {
        const statuses = Object.values(providerSummary).map(summary => summary.currentStatus);
        
        if (statuses.includes(this.eligibilityStatuses.ACTIVE)) {
            return this.eligibilityStatuses.ACTIVE;
        } else if (statuses.includes(this.eligibilityStatuses.PENDING)) {
            return this.eligibilityStatuses.PENDING;
        } else {
            return this.eligibilityStatuses.INACTIVE;
        }
    }

    async analyzeCoordinationOfBenefits(activeVerifications) {
        // Simplified COB analysis
        let primary = null;
        let secondary = null;

        // Sort by verification date (most recent first)
        const sortedVerifications = activeVerifications.sort((a, b) => 
            new Date(b.verificationDate) - new Date(a.verificationDate)
        );

        if (sortedVerifications.length >= 1) {
            primary = {
                provider: sortedVerifications[0].insuranceProvider,
                verification: sortedVerifications[0]
            };
        }

        if (sortedVerifications.length >= 2) {
            secondary = {
                provider: sortedVerifications[1].insuranceProvider,
                verification: sortedVerifications[1]
            };
        }

        return {
            primary,
            secondary,
            rules: {
                birthdayRule: 'Apply birthday rule for dependent coordination',
                genderRule: 'Male subscriber takes precedence for dependents'
            },
            recommendations: [
                'Verify which insurance should be billed primary',
                'Confirm patient understanding of coordination rules',
                'Update claims processing order accordingly'
            ]
        };
    }

    async updatePatientInsurance(patientId, eligibilityData, practiceContext) {
        const context = {
            serviceId: this.serviceName,
            operation: 'updatePatientInsurance',
            practiceId: practiceContext.practiceId
        };

        const updateData = {
            insuranceInfo: {
                memberId: eligibilityData.memberInfo.memberId,
                planName: eligibilityData.planInfo.planName,
                planType: eligibilityData.planInfo.planType,
                groupNumber: eligibilityData.planInfo.groupNumber,
                effectiveDate: eligibilityData.memberInfo.effectiveDate,
                lastVerified: new Date()
            }
        };

        const proxy = getServiceProxy();
        const SecureDataAccess = proxy.getService('secureDataAccess');
        await SecureDataAccess.update('patients',
            { _id: patientId },
            updateData,
            context
        );
    }

    getEligibilityMessage(status, language) {
        const messages = {
            [this.eligibilityStatuses.ACTIVE]: {
                he: 'הביטוח פעיל וזכאי',
                en: 'Insurance is active and eligible'
            },
            [this.eligibilityStatuses.INACTIVE]: {
                he: 'הביטוח אינו פעיל',
                en: 'Insurance is not active'
            },
            [this.eligibilityStatuses.TERMINATED]: {
                he: 'הביטוח בוטל',
                en: 'Insurance has been terminated'
            },
            [this.eligibilityStatuses.PENDING]: {
                he: 'הביטוח בהמתנה',
                en: 'Insurance is pending'
            }
        };

        return messages[status]?.[language] || messages[status]?.en || 'Unknown status';
    }

    getEnrollmentStatusMessage(status, language) {
        return this.getEligibilityMessage(status, language);
    }

    /**
     * Validation methods
     */
    validateEligibilityRequest(data) {
        const errors = [];
        const processedData = {};

        if (!data.patientId) {
            errors.push('Patient ID is required');
        } else {
            processedData.patientId = data.patientId;
        }

        if (!data.insuranceProvider) {
            errors.push('Insurance provider is required');
        } else {
            processedData.insuranceProvider = data.insuranceProvider;
        }

        if (!data.memberId) {
            errors.push('Member ID is required');
        } else {
            processedData.memberId = data.memberId;
        }

        if (!data.dateOfBirth) {
            errors.push('Date of birth is required');
        } else {
            processedData.dateOfBirth = data.dateOfBirth;
        }

        if (!data.serviceDate) {
            processedData.serviceDate = new Date().toISOString().split('T')[0];
        } else {
            processedData.serviceDate = data.serviceDate;
        }

        processedData.subscriberInfo = data.subscriberInfo || {};

        return { success: errors.length === 0, errors, processedData };
    }

    async auditEligibilityAction(action, details) {
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
const insuranceEligibility = new InsuranceEligibility();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('insuranceEligibilityService', () => insuranceEligibility);
}

module.exports = insuranceEligibility;