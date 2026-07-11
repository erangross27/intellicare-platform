/**
 * Function Groups Service - Shared Core Domain
 * Organizes 424+ platform functions into logical groups for easier navigation
 * Provides smart suggestions based on user intent
 * 
 * Features:
 * - Hierarchical organization of platform functions
 * - Role-based function filtering (doctor, secretary, admin)
 * - Bilingual support (English/Hebrew)
 * - Context-aware smart suggestions
 * - Quick actions for common tasks
 * - Function search and discovery
 * - Time-based workflow suggestions
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface LocalizedName {
  en: string;
  he: string;
}

export interface SubGroup {
  name: LocalizedName;
  functions: string[];
}

export interface FunctionGroup {
  name: LocalizedName;
  icon: string;
  description: LocalizedName;
  priority: number;
  functions?: string[];
  subgroups?: Record<string, SubGroup>;
}

export interface FormattedGroup {
  key: string;
  name: string;
  icon: string;
  description: string;
  priority: number;
  functions: string[];
  subgroups: FormattedSubGroup[];
}

export interface FormattedSubGroup {
  key: string;
  name: string;
  functions: string[];
}

export interface QuickAction {
  icon: string;
  label: string;
  command: string;
  group: string;
}

export interface QuickActions {
  title: string;
  actions: QuickAction[];
}

export interface SearchResult {
  function: string;
  group: string;
  subgroup?: string;
  groupKey: string;
  subgroupKey?: string;
  icon: string;
}

export interface SmartSuggestion {
  title: string;
  icon: string;
  functions: string[];
}

export interface UserContext {
  lastAction?: string;
  currentPatient?: string;
  userRole?: string;
  workflowStep?: string;
}

export type UserRole = 'doctor' | 'secretary' | 'admin';
export type Language = 'en' | 'he';

@Injectable()
export class FunctionGroupsService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  
  private groups: Record<string, FunctionGroup>;
  private quickActions: Record<string, string[]>;

  constructor(private configService: ConfigService) {
    this.groups = this.initializeGroups();
    this.quickActions = this.initializeQuickActions();
  }

  async onModuleInit() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('function-groups-service');
      this.initialized = true;
      console.log('✅ Function Groups Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Function Groups Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'function-groups-service',
      operation: 'function_group_operations',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  /**
   * Get groups based on user role or context
   */
  getRelevantGroups(userRole?: UserRole, context?: UserContext, language: Language = 'en'): FormattedGroup[] {
    if (userRole === 'doctor') {
      return this.getDoctorGroups(language);
    } else if (userRole === 'secretary') {
      return this.getSecretaryGroups(language);
    } else if (userRole === 'admin') {
      return this.getAdminGroups(language);
    }
    
    // Default to all groups
    return this.getAllGroups(language);
  }

  /**
   * Get quick actions for common tasks
   */
  getQuickActions(language: Language = 'en'): QuickActions {
    const isHebrew = language === 'he';
    
    return {
      title: isHebrew ? '⚡ פעולות מהירות' : '⚡ Quick Actions',
      actions: [
        {
          icon: '➕',
          label: isHebrew ? 'מטופל חדש' : 'New Patient',
          command: isHebrew ? 'הוסף מטופל חדש' : 'Add new patient',
          group: 'patient_management'
        },
        {
          icon: '🔍',
          label: isHebrew ? 'חיפוש מטופל' : 'Find Patient',
          command: isHebrew ? 'חפש מטופל' : 'Search patient',
          group: 'patient_management'
        },
        {
          icon: '📅',
          label: isHebrew ? 'קביעת תור' : 'Book Appointment',
          command: isHebrew ? 'קבע תור' : 'Schedule appointment',
          group: 'scheduling'
        },
        {
          icon: '💊',
          label: isHebrew ? 'מרשם חדש' : 'New Prescription',
          command: isHebrew ? 'צור מרשם' : 'Create prescription',
          group: 'medications'
        },
        {
          icon: '📄',
          label: isHebrew ? 'העלה מסמך' : 'Upload Document',
          command: isHebrew ? 'העלה מסמך' : 'Upload document',
          group: 'documents'
        },
        {
          icon: '🧪',
          label: isHebrew ? 'תוצאות בדיקה' : 'Lab Results',
          command: isHebrew ? 'הוסף תוצאת בדיקה' : 'Add lab result',
          group: 'lab_tests'
        }
      ]
    };
  }

  /**
   * Search for functions across all groups
   */
  searchFunctions(query: string, language: Language = 'en'): SearchResult[] {
    const results: SearchResult[] = [];
    const searchTerm = query.toLowerCase();
    
    for (const [groupKey, group] of Object.entries(this.groups)) {
      // Search in main functions
      if (group.functions) {
        for (const func of group.functions) {
          if (func.toLowerCase().includes(searchTerm)) {
            results.push({
              function: func,
              group: group.name[language] || group.name.en,
              groupKey,
              icon: group.icon
            });
          }
        }
      }
      
      // Search in subgroups
      if (group.subgroups) {
        for (const [subKey, subgroup] of Object.entries(group.subgroups)) {
          for (const func of subgroup.functions) {
            if (func.toLowerCase().includes(searchTerm)) {
              results.push({
                function: func,
                group: group.name[language] || group.name.en,
                subgroup: subgroup.name[language] || subgroup.name.en,
                groupKey,
                subgroupKey: subKey,
                icon: group.icon
              });
            }
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Get smart suggestions based on context
   */
  getSmartSuggestions(context: UserContext = {}, language: Language = 'en'): SmartSuggestion[] {
    const isHebrew = language === 'he';
    const suggestions: SmartSuggestion[] = [];
    
    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour < 10) {
      // Morning - suggest daily startup tasks
      suggestions.push({
        title: isHebrew ? 'משימות בוקר' : 'Morning Tasks',
        icon: '☀️',
        functions: ['getTodayAppointments', 'getActiveAlerts', 'getOverdueAppointments']
      });
    } else if (hour >= 17) {
      // Evening - suggest end of day tasks
      suggestions.push({
        title: isHebrew ? 'סיום יום' : 'End of Day',
        icon: '🌙',
        functions: ['generateClinicReport', 'runBackup', 'scheduleReminder']
      });
    }
    
    // Context-based suggestions
    if (context.lastAction === 'addPatient') {
      suggestions.push({
        title: isHebrew ? 'אחרי הוספת מטופל' : 'After Adding Patient',
        icon: '➡️',
        functions: ['scheduleAppointment', 'verifyInsurance', 'addMedicalHistory']
      });
    } else if (context.lastAction === 'uploadDocument') {
      suggestions.push({
        title: isHebrew ? 'אחרי העלאת מסמך' : 'After Document Upload',
        icon: '📄',
        functions: ['analyzeDocument', 'categorizeDocument', 'extractMedicalData']
      });
    }
    
    return suggestions;
  }

  /**
   * Get functions by category
   */
  getFunctionsByCategory(category: string): string[] {
    return this.quickActions[category] || [];
  }

  /**
   * Get group by key
   */
  getGroupByKey(key: string, language: Language = 'en'): FormattedGroup | null {
    const group = this.groups[key];
    if (!group) return null;

    return this.formatSingleGroup(key, group, language);
  }

  /**
   * Get all function names across all groups
   */
  getAllFunctionNames(): string[] {
    const functions = new Set<string>();
    
    for (const group of Object.values(this.groups)) {
      if (group.functions) {
        group.functions.forEach(func => functions.add(func));
      }
      
      if (group.subgroups) {
        for (const subgroup of Object.values(group.subgroups)) {
          subgroup.functions.forEach(func => functions.add(func));
        }
      }
    }
    
    return Array.from(functions).sort();
  }

  /**
   * Get statistics about function groups
   */
  getGroupStatistics() {
    let totalFunctions = 0;
    let totalGroups = Object.keys(this.groups).length;
    let totalSubgroups = 0;
    
    for (const group of Object.values(this.groups)) {
      if (group.functions) {
        totalFunctions += group.functions.length;
      }
      
      if (group.subgroups) {
        const subgroupCount = Object.keys(group.subgroups).length;
        totalSubgroups += subgroupCount;
        
        for (const subgroup of Object.values(group.subgroups)) {
          totalFunctions += subgroup.functions.length;
        }
      }
    }
    
    return {
      totalFunctions,
      totalGroups,
      totalSubgroups,
      averageFunctionsPerGroup: Math.round(totalFunctions / totalGroups)
    };
  }

  // ========== ROLE-SPECIFIC GROUPS ==========

  /**
   * Get doctor-specific groups
   */
  private getDoctorGroups(language: Language): FormattedGroup[] {
    const groups = ['daily_operations', 'clinical_care', 'patient_management', 
                   'medications', 'lab_imaging', 'scheduling', 'documents', 
                   'ai_assistance', 'communication'];
    return this.getGroupsByKeys(groups, language);
  }

  /**
   * Get secretary-specific groups
   */
  private getSecretaryGroups(language: Language): FormattedGroup[] {
    const groups = ['daily_operations', 'patient_management', 'scheduling', 
                   'documents', 'communication', 'billing_insurance', 
                   'reports_analytics'];
    return this.getGroupsByKeys(groups, language);
  }

  /**
   * Get admin-specific groups
   */
  private getAdminGroups(language: Language): FormattedGroup[] {
    const groups = ['user_management', 'system_admin', 'compliance_security', 
                   'reports_analytics', 'billing_insurance', 'integrations'];
    return this.getGroupsByKeys(groups, language);
  }

  /**
   * Get all groups
   */
  private getAllGroups(language: Language): FormattedGroup[] {
    return this.formatGroups(this.groups, language);
  }

  /**
   * Get groups by keys
   */
  private getGroupsByKeys(keys: string[], language: Language): FormattedGroup[] {
    const selectedGroups: Record<string, FunctionGroup> = {};
    for (const key of keys) {
      if (this.groups[key]) {
        selectedGroups[key] = this.groups[key];
      }
    }
    return this.formatGroups(selectedGroups, language);
  }

  /**
   * Format groups for display
   */
  private formatGroups(groups: Record<string, FunctionGroup>, language: Language): FormattedGroup[] {
    const formatted: FormattedGroup[] = [];
    
    for (const [key, group] of Object.entries(groups)) {
      formatted.push(this.formatSingleGroup(key, group, language));
    }
    
    // Sort by priority
    return formatted.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Format single group for display
   */
  private formatSingleGroup(key: string, group: FunctionGroup, language: Language): FormattedGroup {
    const formattedGroup: FormattedGroup = {
      key,
      name: group.name[language] || group.name.en,
      icon: group.icon,
      description: group.description[language] || group.description.en,
      priority: group.priority,
      functions: group.functions || [],
      subgroups: []
    };
    
    if (group.subgroups) {
      for (const [subKey, subgroup] of Object.entries(group.subgroups)) {
        formattedGroup.subgroups.push({
          key: subKey,
          name: subgroup.name[language] || subgroup.name.en,
          functions: subgroup.functions
        });
      }
    }
    
    return formattedGroup;
  }

  // ========== INITIALIZATION ==========

  /**
   * Initialize all function groups
   */
  private initializeGroups(): Record<string, FunctionGroup> {
    return {
      // Core Clinical Groups
      daily_operations: {
        name: { en: 'Daily Operations', he: 'פעולות יומיות' },
        icon: '🏥',
        description: { 
          en: 'Most commonly used functions for daily clinic operations',
          he: 'הפונקציות הנפוצות ביותר לפעולות יומיות במרפאה'
        },
        priority: 1,
        functions: [
          'searchPatients', 'addPatient', 'scheduleAppointment', 'getTodayAppointments',
          'addVitalSigns', 'createPrescription', 'uploadDocument', 'sendSMS'
        ]
      },

      patient_management: {
        name: { en: 'Patient Management', he: 'ניהול מטופלים' },
        icon: '👥',
        description: { 
          en: 'Complete patient lifecycle management',
          he: 'ניהול מחזור חיי המטופל המלא'
        },
        priority: 2,
        subgroups: {
          registration: {
            name: { en: 'Registration', he: 'רישום' },
            functions: ['addPatient', 'verifyInsurance', 'recordConsent']
          },
          search_view: {
            name: { en: 'Search & View', he: 'חיפוש וצפייה' },
            functions: ['searchPatients', 'getPatientDetails', 'countPatients']
          },
          update_manage: {
            name: { en: 'Update & Manage', he: 'עדכון וניהול' },
            functions: ['updatePatient', 'deletePatientBySearch', 'restorePatient', 'permanentlyDeletePatient']
          },
          history: {
            name: { en: 'Medical History', he: 'היסטוריה רפואית' },
            functions: ['addMedicalHistory', 'getMedicalHistory', 'updateMedicalHistory', 'deleteMedicalHistory']
          }
        }
      },

      clinical_care: {
        name: { en: 'Clinical Care', he: 'טיפול קליני' },
        icon: '🩺',
        description: { 
          en: 'Direct patient care and treatment functions',
          he: 'פונקציות טיפול ישיר במטופלים'
        },
        priority: 3,
        subgroups: {
          diagnosis: {
            name: { en: 'Diagnosis & Assessment', he: 'אבחון והערכה' },
            functions: [
              'analyzeSymptoms', 'generateDiagnosis', 'getDifferentialDiagnosis',
              'interpretLabResults', 'analyzeVitalSigns', 'generateSOAPNote'
            ]
          },
          treatment: {
            name: { en: 'Treatment Planning', he: 'תכנון טיפול' },
            functions: [
              'recommendTreatment', 'generateTreatmentRecommendations', 
              'lookupClinicalGuidelines', 'calculateMedicationDosing'
            ]
          },
          monitoring: {
            name: { en: 'Patient Monitoring', he: 'מעקב מטופלים' },
            functions: [
              'analyzeVitalTrends', 'flagCriticalValues', 'setVitalAlerts',
              'showTrendAnalysis', 'compareMetrics'
            ]
          }
        }
      },

      medications: {
        name: { en: 'Medications & Prescriptions', he: 'תרופות ומרשמים' },
        icon: '💊',
        description: { 
          en: 'Medication management and prescription handling',
          he: 'ניהול תרופות וטיפול במרשמים'
        },
        priority: 4,
        subgroups: {
          prescriptions: {
            name: { en: 'Prescriptions', he: 'מרשמים' },
            functions: [
              'createPrescription', 'generatePrescription', 'refillPrescription',
              'cancelPrescription', 'validatePrescription', 'getPrescriptions'
            ]
          },
          medications: {
            name: { en: 'Medication Management', he: 'ניהול תרופות' },
            functions: [
              'addMedication', 'getMedications', 'prescribeMedication',
              'requestPrescriptionRefill', 'sendMedicationRefillReminders'
            ]
          },
          safety: {
            name: { en: 'Drug Safety', he: 'בטיחות תרופתית' },
            functions: [
              'checkDrugInteractions', 'checkDrugAllergy', 'checkDrugSafety',
              'checkDrugAdverseEvents', 'searchDrugInformation'
            ]
          }
        }
      },

      lab_imaging: {
        name: { en: 'Labs & Imaging', he: 'מעבדה ודימות' },
        icon: '🔬',
        description: { 
          en: 'Laboratory tests and medical imaging',
          he: 'בדיקות מעבדה ודימות רפואי'
        },
        priority: 5,
        subgroups: {
          lab_tests: {
            name: { en: 'Laboratory Tests', he: 'בדיקות מעבדה' },
            functions: [
              'addLabResult', 'getLabResults', 'orderLabTest',
              'interpretLabResults', 'parseLabResults', 'flagCriticalValues'
            ]
          },
          imaging: {
            name: { en: 'Medical Imaging', he: 'דימות רפואי' },
            functions: [
              'orderImaging', 'getImagingResults', 'uploadImagingResult',
              'addImagingResult'
            ]
          }
        }
      },

      scheduling: {
        name: { en: 'Scheduling & Calendar', he: 'תיאום ולוח זמנים' },
        icon: '📅',
        description: { 
          en: 'Appointment scheduling and calendar management',
          he: 'תיאום פגישות וניהול לוח זמנים'
        },
        priority: 6,
        subgroups: {
          appointments: {
            name: { en: 'Appointments', he: 'תורים' },
            functions: [
              'scheduleAppointment', 'findAvailableSlots', 'updateAppointment',
              'cancelAppointment', 'rescheduleAppointment', 'getAppointments',
              'getTodayAppointments', 'getOverdueAppointments'
            ]
          },
          provider_schedule: {
            name: { en: 'Provider Schedule', he: 'לוח זמנים רופא' },
            functions: [
              'getProviderSchedule', 'setDoctorAvailability', 'blockDoctorTime',
              'setMyBusyTime', 'cancelMyBusyTime', 'showMyBusyTimes'
            ]
          },
          calendar_sync: {
            name: { en: 'Calendar Integration', he: 'סנכרון יומן' },
            functions: [
              'syncWithGoogleCalendar', 'enableCalendarSync', 'disableCalendarSync',
              'getCalendarSyncStatus', 'sendCalendarSyncEmail'
            ]
          }
        }
      },

      documents: {
        name: { en: 'Documents & Records', he: 'מסמכים ורשומות' },
        icon: '📄',
        description: { 
          en: 'Document management and medical records',
          he: 'ניהול מסמכים ורשומות רפואיות'
        },
        priority: 7,
        subgroups: {
          document_management: {
            name: { en: 'Document Management', he: 'ניהול מסמכים' },
            functions: [
              'uploadDocument', 'getDocuments', 'deleteDocument',
              'searchDocuments', 'listDocuments', 'shareEncryptedDocument'
            ]
          },
          document_analysis: {
            name: { en: 'Document Analysis', he: 'ניתוח מסמכים' },
            functions: [
              'analyzeDocument', 'batchAnalyzeDocuments', 'categorizeDocument',
              'extractMedicalData'
            ]
          }
        }
      },

      communication: {
        name: { en: 'Communication', he: 'תקשורת' },
        icon: '💬',
        description: { 
          en: 'Patient and team communication',
          he: 'תקשורת עם מטופלים וצוות'
        },
        priority: 8,
        subgroups: {
          messaging: {
            name: { en: 'Messaging', he: 'הודעות' },
            functions: [
              'sendSMS', 'sendEmail', 'sendBulkPatientSMS', 'sendBulkPatientEmail',
              'sendPatientPortalMessage', 'sendChatMessage'
            ]
          },
          notifications: {
            name: { en: 'Notifications', he: 'התראות' },
            functions: [
              'scheduleReminder', 'sendAppointmentConfirmationRequest',
              'sendTestResultNotifications', 'sendMedicationRefillReminders',
              'getReminderHistory'
            ]
          }
        }
      },

      // Administrative Groups
      billing_insurance: {
        name: { en: 'Billing & Insurance', he: 'חיוב וביטוח' },
        icon: '💰',
        description: { 
          en: 'Insurance verification, billing and payments',
          he: 'אימות ביטוח, חיוב ותשלומים'
        },
        priority: 9,
        subgroups: {
          insurance: {
            name: { en: 'Insurance', he: 'ביטוח' },
            functions: [
              'verifyInsurance', 'checkCoverage', 'checkFormularyCoverage',
              'verifyInsuranceNetwork', 'getInsuranceDetails', 'updateInsurance'
            ]
          },
          claims: {
            name: { en: 'Claims & Authorization', he: 'תביעות ואישורים' },
            functions: [
              'submitInsuranceClaim', 'submitPreAuthorization', 'submitPriorAuthorization',
              'checkMedicareCoverage', 'checkMedicaidEligibility'
            ]
          },
          billing: {
            name: { en: 'Billing & Payments', he: 'חיוב ותשלומים' },
            functions: [
              'createInvoice', 'recordPayment', 'getOutstandingBalances'
            ]
          }
        }
      },

      reports_analytics: {
        name: { en: 'Reports & Analytics', he: 'דוחות ואנליטיקה' },
        icon: '📊',
        description: { 
          en: 'Generate reports and analyze data',
          he: 'יצירת דוחות וניתוח נתונים'
        },
        priority: 10,
        subgroups: {
          clinical_reports: {
            name: { en: 'Clinical Reports', he: 'דוחות קליניים' },
            functions: [
              'generatePatientReport', 'generateSOAPNote', 'generateDiagnosis',
              'generateTreatmentRecommendations'
            ]
          },
          administrative_reports: {
            name: { en: 'Administrative Reports', he: 'דוחות מנהליים' },
            functions: [
              'generateClinicReport', 'getClinicStatistics', 'getClinicUsage',
              'generateCommunicationReport', 'getCommunicationAnalytics'
            ]
          },
          compliance_reports: {
            name: { en: 'Compliance Reports', he: 'דוחות תאימות' },
            functions: [
              'generateComplianceReport', 'generateComplianceReportDetailed',
              'generateAuditReport', 'generateIncidentReport', 'generateBreachReport'
            ]
          }
        }
      },

      user_management: {
        name: { en: 'User & Access Management', he: 'ניהול משתמשים והרשאות' },
        icon: '🔐',
        description: { 
          en: 'User accounts, roles and permissions',
          he: 'חשבונות משתמש, תפקידים והרשאות'
        },
        priority: 11,
        subgroups: {
          users: {
            name: { en: 'User Management', he: 'ניהול משתמשים' },
            functions: [
              'createUser', 'getAllUsers', 'searchUsers', 'updateUserProfile',
              'suspendUser', 'deactivateUser', 'reactivateUser', 'deleteUser'
            ]
          },
          roles_permissions: {
            name: { en: 'Roles & Permissions', he: 'תפקידים והרשאות' },
            functions: [
              'assignRole', 'updateUserRole', 'getRoles', 'bulkUpdateRoles',
              'getUserPermissions', 'updateUserPermissions', 'getClinicPermissions'
            ]
          },
          authentication: {
            name: { en: 'Authentication', he: 'אימות' },
            functions: [
              'setupMFA', 'getMFAStatus', 'disableMFA', 'resetUserPassword',
              'initiatePasswordlessLogin', 'verifyPasswordlessCode'
            ]
          }
        }
      },

      // Specialized Groups
      ai_assistance: {
        name: { en: 'AI & Clinical Decision Support', he: 'AI ותמיכה בהחלטות קליניות' },
        icon: '🤖',
        description: { 
          en: 'AI-powered diagnosis and recommendations',
          he: 'אבחון והמלצות מבוססי AI'
        },
        priority: 12,
        functions: [
          'analyzeSymptoms', 'generateDiagnosis', 'getDifferentialDiagnosis',
          'recommendTreatment', 'recommendTests', 'interpretLabResults',
          'analyzeVitalSigns', 'generatePatientEducation', 'getEvidenceBasedRecommendations'
        ]
      },

      emergency_critical: {
        name: { en: 'Emergency & Critical Care', he: 'חירום וטיפול קריטי' },
        icon: '🚨',
        description: { 
          en: 'Emergency response and critical care functions',
          he: 'פונקציות חירום וטיפול קריטי'
        },
        priority: 13,
        functions: [
          'flagCriticalValues', 'setVitalAlerts', 'escalateIncident',
          'reportIncident', 'getActiveAlerts', 'acknowledgeSecurityAlert'
        ]
      },

      compliance_security: {
        name: { en: 'Compliance & Security', he: 'תאימות ואבטחה' },
        icon: '🛡️',
        description: { 
          en: 'HIPAA, GDPR compliance and security',
          he: 'תאימות HIPAA, GDPR ואבטחה'
        },
        priority: 14,
        subgroups: {
          compliance: {
            name: { en: 'Compliance', he: 'תאימות' },
            functions: [
              'checkRegulatoryCompliance', 'calculateComplianceScore', 'getComplianceStatus',
              'scheduleComplianceAudit', 'scheduleComplianceReports'
            ]
          },
          security: {
            name: { en: 'Security', he: 'אבטחה' },
            functions: [
              'getSecurityAlerts', 'getSecurityMetrics', 'rotateEncryptionKeys',
              'blockIP', 'unblockIP', 'checkIPReputation'
            ]
          },
          audit: {
            name: { en: 'Audit & Monitoring', he: 'ביקורת וניטור' },
            functions: [
              'getAuditLogs', 'exportAuditLogs', 'exportAuditReport',
              'getUserActivity', 'getRecentSecurityEvents'
            ]
          }
        }
      },

      integrations: {
        name: { en: 'External Integrations', he: 'אינטגרציות חיצוניות' },
        icon: '🔗',
        description: { 
          en: 'Connect with external systems and APIs',
          he: 'חיבור למערכות חיצוניות ו-APIs'
        },
        priority: 15,
        subgroups: {
          health_apis: {
            name: { en: 'Health APIs', he: 'ממשקי בריאות' },
            functions: [
              'searchFDADrugs', 'getFDARecalls', 'getFDASafetyAlerts',
              'getCDCHealthGuidelines', 'getCDCDiseaseData', 'searchMedicareDoctors'
            ]
          },
          research: {
            name: { en: 'Research & Literature', he: 'מחקר וספרות' },
            functions: [
              'searchClinicalTrials', 'matchPatientToTrials', 'searchMedicalLiterature',
              'searchNCBIDatasets', 'searchNIHProjects'
            ]
          },
          webhooks: {
            name: { en: 'Webhooks & APIs', he: 'Webhooks וממשקים' },
            functions: [
              'createWebhook', 'testWebhook', 'listWebhooks', 'deleteWebhook',
              'testExternalAPIConnection'
            ]
          }
        }
      },

      system_admin: {
        name: { en: 'System Administration', he: 'ניהול מערכת' },
        icon: '⚙️',
        description: { 
          en: 'System maintenance and administration',
          he: 'תחזוקה וניהול מערכת'
        },
        priority: 16,
        subgroups: {
          maintenance: {
            name: { en: 'Maintenance', he: 'תחזוקה' },
            functions: [
              'runBackup', 'restoreBackup', 'scheduleBackup', 'listBackups',
              'clearCache', 'optimizeDatabase', 'rebuildIndexes'
            ]
          },
          monitoring: {
            name: { en: 'Monitoring', he: 'ניטור' },
            functions: [
              'getSystemHealth', 'getSystemHealthDetailed', 'getSystemMetrics',
              'getServerHealth', 'getDatabaseStats'
            ]
          },
          configuration: {
            name: { en: 'Configuration', he: 'הגדרות' },
            functions: [
              'updateClinicSettings', 'updateDoctorSettings', 'setCurrency',
              'updateTranslations', 'updateRetentionPolicy'
            ]
          }
        }
      }
    };
  }

  /**
   * Initialize quick actions
   */
  private initializeQuickActions(): Record<string, string[]> {
    return {
      patient: ['addPatient', 'searchPatients', 'getPatientDetails'],
      appointment: ['scheduleAppointment', 'getTodayAppointments', 'findAvailableSlots'],
      medical: ['addVitalSigns', 'addLabResult', 'createPrescription'],
      document: ['uploadDocument', 'analyzeDocument', 'searchDocuments'],
      communication: ['sendSMS', 'sendEmail', 'scheduleReminder']
    };
  }

  // ========== AUDIT LOGGING ==========

  private async logServiceOperation(operation: string, details: any, clinicId?: string) {
    if (!this.initialized) return;
    
    const context = this.getServiceContext(clinicId);

    try {
      await SecureDataAccess.insert('audit_logs', {
        action: operation,
        resourceType: 'function_groups',
        userId: 'system',
        details: details,
        timestamp: new Date()
      }, context);
    } catch (error) {
      console.error('Failed to log service operation:', error);
    }
  }
}