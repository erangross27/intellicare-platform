/**
 * Analytics Functions Module for Agent Service
 * Contains data analysis and reporting functions
 */

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AnalyticsFunctions {
    constructor() {
        this.initialized = false;
        this.serviceToken = null;
    }

    async initialize() {
        if (this.initialized) return;
        
        // Authenticate service
        try {
            const proxy = getServiceProxy();
            const serviceAccountManager = proxy.getService('serviceAccountManager');
            this.serviceToken = await serviceAccountManager.authenticate('agent-service-analytics-functions');
            console.log('✅ AnalyticsFunctions authenticated');
        } catch (error) {
            console.error('❌ AnalyticsFunctions authentication failed:', error.message);
            throw error;
        }
        
        this.initialized = true;
    }

    // Clinical analytics
    async getPatientStatistics(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const patients = await secureDataAccess.query('patients',
            { practiceId: params.practiceId },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getPatientStatistics',
                practiceId: params.practiceId
            }
        );

        return {
            totalPatients: patients.length,
            activePatients: patients.filter(p => p.status === 'active').length,
            newPatientsThisMonth: patients.filter(p => {
                const created = new Date(p.createdAt);
                const now = new Date();
                return created.getMonth() === now.getMonth() && 
                       created.getFullYear() === now.getFullYear();
            }).length
        };
    }

    async getAppointmentAnalytics(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = params.endDate || new Date();

        const appointments = await secureDataAccess.query('appointments',
            {
                practiceId: params.practiceId,
                appointmentDate: {
                    $gte: startDate,
                    $lte: endDate
                }
            },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getAppointmentAnalytics',
                practiceId: params.practiceId
            }
        );

        const completed = appointments.filter(a => a.status === 'completed').length;
        const cancelled = appointments.filter(a => a.status === 'cancelled').length;
        const noShow = appointments.filter(a => a.status === 'no-show').length;

        return {
            total: appointments.length,
            completed,
            cancelled,
            noShow,
            completionRate: appointments.length > 0 ? (completed / appointments.length * 100).toFixed(2) : 0,
            cancellationRate: appointments.length > 0 ? (cancelled / appointments.length * 100).toFixed(2) : 0
        };
    }

    async getRevenueAnalytics(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = params.endDate || new Date();

        const invoices = await secureDataAccess.query('invoices',
            {
                practiceId: params.practiceId,
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getRevenueAnalytics',
                practiceId: params.practiceId
            }
        );

        const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const paidInvoices = invoices.filter(inv => inv.status === 'paid');
        const paidRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

        return {
            totalRevenue,
            paidRevenue,
            pendingRevenue: totalRevenue - paidRevenue,
            invoiceCount: invoices.length,
            paidCount: paidInvoices.length,
            averageInvoiceAmount: invoices.length > 0 ? (totalRevenue / invoices.length).toFixed(2) : 0
        };
    }

    async getProviderPerformance(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const appointments = await secureDataAccess.query('appointments',
            {
                practiceId: params.practiceId,
                providerId: params.providerId,
                status: 'completed'
            },
            { limit: 1000 },
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getProviderPerformance',
                practiceId: params.practiceId
            }
        );

        const patientFeedback = await secureDataAccess.query('feedback',
            {
                practiceId: params.practiceId,
                providerId: params.providerId
            },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getProviderFeedback',
                practiceId: params.practiceId
            }
        );

        const avgRating = patientFeedback.length > 0
            ? (patientFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / patientFeedback.length).toFixed(2)
            : 0;

        return {
            totalAppointments: appointments.length,
            averageRating: avgRating,
            feedbackCount: patientFeedback.length,
            patientsServed: new Set(appointments.map(a => a.patientId)).size
        };
    }

    async getDiagnosisDistribution(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const medicalRecords = await secureDataAccess.query('medicalRecords',
            {
                practiceId: params.practiceId,
                createdAt: {
                    $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                }
            },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getDiagnosisDistribution',
                practiceId: params.practiceId
            }
        );

        const diagnosisCounts = {};
        medicalRecords.forEach(record => {
            if (record.diagnosis) {
                diagnosisCounts[record.diagnosis] = (diagnosisCounts[record.diagnosis] || 0) + 1;
            }
        });

        const sortedDiagnoses = Object.entries(diagnosisCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([diagnosis, count]) => ({ diagnosis, count }));

        return {
            topDiagnoses: sortedDiagnoses,
            totalRecords: medicalRecords.length,
            uniqueDiagnoses: Object.keys(diagnosisCounts).length
        };
    }

    async getMedicationUsage(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const prescriptions = await secureDataAccess.query('prescriptions',
            {
                practiceId: params.practiceId,
                prescribedAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getMedicationUsage',
                practiceId: params.practiceId
            }
        );

        const medicationCounts = {};
        prescriptions.forEach(rx => {
            if (rx.medication) {
                medicationCounts[rx.medication] = (medicationCounts[rx.medication] || 0) + 1;
            }
        });

        const topMedications = Object.entries(medicationCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([medication, count]) => ({ medication, count }));

        return {
            topMedications,
            totalPrescriptions: prescriptions.length,
            uniqueMedications: Object.keys(medicationCounts).length
        };
    }

    async getClinicUtilization(params) {
        const proxy = getServiceProxy();
        const secureDataAccess = proxy.getService('secureDataAccess');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayAppointments = await secureDataAccess.query('appointments',
            {
                practiceId: params.practiceId,
                appointmentDate: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getClinicUtilization',
                practiceId: params.practiceId
            }
        );

        const providers = await secureDataAccess.query('users',
            {
                practiceId: params.practiceId,
                roles: { $in: ['doctor', 'provider'] }
            },
            {},
            {
                serviceId: 'agent-service-analytics-functions',
                operation: 'getProviders',
                practiceId: params.practiceId
            }
        );

        const slotsPerProvider = 8; // Assume 8 appointment slots per day
        const totalSlots = providers.length * slotsPerProvider;
        const utilization = totalSlots > 0 ? (todayAppointments.length / totalSlots * 100).toFixed(2) : 0;

        return {
            todayAppointments: todayAppointments.length,
            totalProviders: providers.length,
            totalSlots,
            utilizationRate: utilization
        };
    }

    // Export analytics functions list
    getFunctionList() {
        return [
            'getPatientStatistics',
            'getAppointmentAnalytics',
            'getRevenueAnalytics',
            'getProviderPerformance',
            'getDiagnosisDistribution',
            'getMedicationUsage',
            'getClinicUtilization'
        ];
    }
}

// Create singleton instance
const analyticsFunctions = new AnalyticsFunctions();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('analyticsFunctions', () => analyticsFunctions);
}

module.exports = analyticsFunctions;