/**
 * Medical Functions Service for Agent Service - DDD Architecture
 * Contains healthcare and patient management functions
 * Location: libs/ai-analytics/feature-claude/medical-functions.service.js
 */

const path = require('path');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class MedicalFunctionsService {
    constructor() {
        this.initialized = false;
        this.serviceToken = null;
        this.serviceName = 'medical-functions-service';
    }

    async initialize() {
        if (this.initialized) return;
        
        // Authenticate service with unique service name
        try {
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceName);
            console.log('✅ MedicalFunctionsService authenticated successfully');
        } catch (error) {
            console.error('❌ MedicalFunctionsService authentication failed:', error.message);
            throw error;
        }
        
        this.initialized = true;
    }

    // Patient management
    async addPatient(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.create('patients', params, {
            serviceId: this.serviceName,
            operation: 'addPatient',
            practiceId: params.practiceId || 'global',
            apiKey: this.serviceToken?.apiKey
        });
    }

    async updatePatient(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.update('patients',
            { _id: params.patientId },
            params.updates,
            {
                serviceId: this.serviceName,
                operation: 'updatePatient',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async getPatient(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('patients',
            { _id: params.patientId },
            {},
            {
                serviceId: this.serviceName,
                operation: 'getPatient',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async searchPatients(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('patients',
            params.filter || {},
            { limit: params.limit || 50, sort: params.sort || { lastName: 1 } },
            {
                serviceId: this.serviceName,
                operation: 'searchPatients',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async deletePatient(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.delete('patients',
            { _id: params.patientId },
            {
                serviceId: this.serviceName,
                operation: 'deletePatient',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    // Medical records
    async addMedicalRecord(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.create('medicalRecords', {
            ...params,
            createdAt: new Date(),
            lastModified: new Date()
        }, {
            serviceId: this.serviceName,
            operation: 'addMedicalRecord',
            practiceId: params.practiceId || 'global'
        });
    }

    async updateMedicalRecord(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.update('medicalRecords',
            { _id: params.recordId },
            { ...params.updates, lastModified: new Date() },
            {
                serviceId: this.serviceName,
                operation: 'updateMedicalRecord',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async getMedicalRecord(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('medicalRecords',
            { _id: params.recordId },
            {},
            {
                serviceId: this.serviceName,
                operation: 'getMedicalRecord',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async getPatientMedicalRecords(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('medicalRecords',
            { patientId: params.patientId },
            { sort: { createdAt: -1 }, limit: params.limit || 100 },
            {
                serviceId: this.serviceName,
                operation: 'getPatientMedicalRecords',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    // Prescriptions
    async prescribeMedication(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.create('prescriptions', {
            patientId: params.patientId,
            medication: params.medication,
            dosage: params.dosage,
            instructions: params.instructions,
            prescribedBy: params.prescribedBy,
            prescribedAt: new Date(),
            status: 'active'
        }, {
            serviceId: this.serviceName,
            operation: 'prescribeMedication',
            practiceId: params.practiceId || 'global'
        });
    }

    async getPatientPrescriptions(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('prescriptions',
            { patientId: params.patientId },
            { sort: { prescribedAt: -1 } },
            {
                serviceId: this.serviceName,
                operation: 'getPatientPrescriptions',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async updatePrescriptionStatus(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.update('prescriptions',
            { _id: params.prescriptionId },
            { status: params.status, lastModified: new Date() },
            {
                serviceId: this.serviceName,
                operation: 'updatePrescriptionStatus',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    // Appointments
    async scheduleAppointment(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.create('appointments', {
            ...params,
            status: 'scheduled',
            createdAt: new Date()
        }, {
            serviceId: this.serviceName,
            operation: 'scheduleAppointment',
            practiceId: params.practiceId || 'global'
        });
    }

    async cancelAppointment(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.update('appointments',
            { _id: params.appointmentId },
            { 
                status: 'cancelled', 
                cancelledAt: new Date(),
                cancellationReason: params.reason || 'Not specified'
            },
            {
                serviceId: this.serviceName,
                operation: 'cancelAppointment',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async getTodayAppointments(params) {
        await this.initialize();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('appointments',
            {
                appointmentDate: {
                    $gte: today,
                    $lt: tomorrow
                },
                status: { $ne: 'cancelled' }
            },
            { sort: { appointmentDate: 1 } },
            {
                serviceId: this.serviceName,
                operation: 'getTodayAppointments',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async getPatientAppointments(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('appointments',
            { patientId: params.patientId },
            { sort: { appointmentDate: -1 }, limit: params.limit || 50 },
            {
                serviceId: this.serviceName,
                operation: 'getPatientAppointments',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    // Lab results
    async addLabResult(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.create('labResults', {
            ...params,
            receivedAt: new Date(),
            status: 'received'
        }, {
            serviceId: this.serviceName,
            operation: 'addLabResult',
            practiceId: params.practiceId || 'global'
        });
    }

    async getPatientLabResults(params) {
        await this.initialize();
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        return secureDataAccess.query('labResults',
            { patientId: params.patientId },
            { sort: { receivedAt: -1 }, limit: params.limit || 50 },
            {
                serviceId: this.serviceName,
                operation: 'getPatientLabResults',
                practiceId: params.practiceId || 'global'
            }
        );
    }

    async interpretLabResults(params) {
        await this.initialize();
        // This would integrate with medical AI service
        try {
            const proxy = getServiceProxy();
            const geminiMedical = proxy.getService('geminiMedicalService');
            if (geminiMedical && geminiMedical.interpretLabResults) {
                return await geminiMedical.interpretLabResults(params);
            }
        } catch (error) {
            console.warn('Medical AI service not available:', error.message);
        }
        
        return {
            interpretation: 'Lab result interpretation requires medical AI service',
            status: 'pending',
            serviceNote: 'Medical AI interpretation service is currently unavailable',
            timestamp: new Date()
        };
    }

    // Symptoms analysis
    async analyzeSymptoms(params) {
        await this.initialize();
        try {
            const proxy = getServiceProxy();
            const geminiMedical = proxy.getService('geminiMedicalService');
            if (geminiMedical && geminiMedical.analyzeSymptoms) {
                return await geminiMedical.analyzeSymptoms(params);
            }
        } catch (error) {
            console.warn('Medical AI service not available for symptom analysis:', error.message);
        }

        return {
            analysis: 'Symptom analysis requires medical AI service',
            status: 'pending',
            serviceNote: 'Medical AI analysis service is currently unavailable',
            timestamp: new Date()
        };
    }

    // Export medical functions list
    getFunctionList() {
        return [
            'addPatient',
            'updatePatient',
            'getPatient',
            'searchPatients',
            'deletePatient',
            'addMedicalRecord',
            'updateMedicalRecord',
            'getMedicalRecord',
            'getPatientMedicalRecords',
            'prescribeMedication',
            'getPatientPrescriptions',
            'updatePrescriptionStatus',
            'scheduleAppointment',
            'cancelAppointment',
            'getTodayAppointments',
            'getPatientAppointments',
            'addLabResult',
            'getPatientLabResults',
            'interpretLabResults',
            'analyzeSymptoms'
        ];
    }

    // Service metadata
    getServiceInfo() {
        return {
            serviceName: this.serviceName,
            version: '2.0.0',
            architecture: 'DDD',
            location: 'libs/ai-analytics/feature-claude/medical-functions.service.js',
            initialized: this.initialized,
            functionCount: this.getFunctionList().length,
            supportedCollections: ['patients', 'medicalRecords', 'prescriptions', 'appointments', 'labResults']
        };
    }
}

// Create singleton instance
const medicalFunctionsService = new MedicalFunctionsService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('medicalFunctionsService', () => medicalFunctionsService);
}

module.exports = medicalFunctionsService;