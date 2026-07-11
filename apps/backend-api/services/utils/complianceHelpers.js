/**
 * Compliance & Security Helper Functions
 *
 * Contains HIPAA compliance, security audit, breach reporting, GDPR,
 * PHI protection, access controls, and regulatory compliance functions.
 *
 * USAGE: Separate API endpoint for admin/security personnel only
 * NOT included in regular medical AI function calls
 *
 * TOKEN SAVINGS: 118 functions (~944 tokens)
 */

class ComplianceHelpers {
  constructor() {
    this.FUNCTION_CACHE = {
      all: {},
      initialized: false
    };
  }

  getAllComplianceFunctions(language = 'en') {
    const cacheKey = `${language}`;

    if (this.FUNCTION_CACHE.initialized && this.FUNCTION_CACHE.all[cacheKey]) {
      if (process.env.QUIET_LOGS !== 'true') console.log(`⚡ Using cached compliance functions for ${cacheKey}`);
      return this.FUNCTION_CACHE.all[cacheKey];
    }

    const isHebrew = language === 'he';

    const complianceFunctions = [
{
          name: "addUserRole",
          description: isHebrew
            ? "הוסף תפקיד או הרשאה למשתמש - השתמש ב-'me' כדי לעדכן את המשתמש הנוכחי. תן, הענק, הוסף תפקיד"
            : "Add a role to user - use 'me' as userId to update current user. Adds roles like admin, doctor, nurse_rn, etc. Keywords: add role, give role, assign role, grant role, make me, give me",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש או אימייל (השתמש ב-'me' למשתמש הנוכחי)" : "User ID or email (use 'me' for current user)" },
              role: { type: "string", description: isHebrew ? "תפקיד להוספה (admin, doctor, nurse_rn וכו')" : "Role to add (admin, doctor, nurse_rn, etc.)" }
            },
            required: ["userId", "role"]
          }
        },

{
          name: "removeUserRole",
          description: isHebrew
            ? "הסר תפקיד ממשתמש - השתמש ב-'me' למשתמש הנוכחי"
            : "Remove role from user - use 'me' for current user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש או אימייל (השתמש ב-'me' למשתמש הנוכחי)" : "User ID or email (use 'me' for current user)" },
              role: { type: "string", description: isHebrew ? "תפקיד להסרה (doctor, nurse_rn וכו')" : "Role to remove (doctor, nurse_rn, etc.)" }
            },
            required: ["userId", "role"]
          }
        },

{
          name: "exportAuditLogs",
          description: isHebrew 
            ? "ייצא יומני ביקורת"
            : "Export audit logs",
          parameters: {
            type: "object",
            properties: {
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date" },
              userFilter: { type: "string", description: isHebrew ? "סינון לפי משתמש" : "Filter by user" },
              actionFilter: { type: "string", description: isHebrew ? "סינון לפי פעולה" : "Filter by action" }
            },
            required: ["dateFrom", "dateTo"]
          }
        },

{
          name: "getGuidelineCompliance",
          description: isHebrew
            ? "קבל הערכת עמידה בקווים מנחים מבוססת AI כולל התאמה לקווים מנחים קליניים, פערים בטיפול, אי-עמידה בפרוטוקולים והמלצות לשיפור. השתמש כאשר המשתמש מבקש לראות, להציג או לבדוק עמידה בקווים מנחים, הקפדה על פרוטוקולים או בדיקת סטנדרטים קליניים"
            : "Get AI-generated guideline compliance assessment including adherence to clinical guidelines, treatment gaps, protocol non-compliance, and improvement recommendations. Use when user asks to see, show, view, or review guideline compliance, protocol adherence, or clinical standards check",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date (YYYY-MM-DD)" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date (YYYY-MM-DD)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            },
            required: ["patientId"]
          }
        },

{
          name: "createPrescription",
          description: isHebrew
            ? "צור מרשם חדש למטופל. תומך במרשמים עם תאריך התחלה עתידי"
            : "Create new prescription for a patient. Supports delayed-start prescriptions with future start dates",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              medications: {
                type: "array",
                items: { type: "object" },
                description: isHebrew ? "רשימת תרופות" : "List of medications"
              },
              instructions: { type: "string", description: isHebrew ? "הוראות כלליות" : "General instructions" },
              startDate: {
                type: "string",
                description: isHebrew
                  ? "תאריך התחלה (ISO format). אם לא צוין, מתחיל מיד. שימושי למרשמים שצריך להתחיל בעתיד (למשל: 2 שבועות מהיום)"
                  : "Start date (ISO format). If not specified, starts immediately. Useful for delayed prescriptions (e.g., 2 weeks from now)"
              },
              validUntil: { type: "string", description: isHebrew ? "תוקף עד" : "Valid until" },
              refills: { type: "number", description: isHebrew ? "מספר חזרות" : "Number of refills" }
            },
            required: ["patientId", "medications"]
          }
        },

{
          name: "getPrescriptions",
          description: isHebrew
            ? "הצג מרשמים של מטופל"
            : "Get prescriptions for a patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              status: { type: "string", description: isHebrew ? "סטטוס (active/expired/all)" : "Status (active/expired/all)", enum: ["active", "expired", "all"] }
            },
            required: ["patientId"]
          }
        },

{
          name: "updatePrescription",
          description: isHebrew
            ? "עדכן מרשם קיים. ניתן לעדכן לפי recordId או patientId"
            : "Update an existing prescription. Can update by recordId (specific prescription) or patientId (patient's prescriptions).",
          parameters: {
            type: "object",
            properties: {
              recordId: {
                type: "string",
                description: isHebrew
                  ? "מזהה המרשם הספציפי (ObjectId). אופציונלי - אם לא מסופק, יש להשתמש ב-patientId"
                  : "OPTIONAL: Specific prescription ID (MongoDB ObjectId). Use this if you know the exact prescription ID. If not provided, use patientId instead."
              },
              patientId: {
                type: "string",
                description: isHebrew
                  ? "מזהה המטופל. אופציונלי - אם לא מסופק recordId. יעדכן את כל המרשמים של המטופל"
                  : "OPTIONAL: Patient ID. Use this if you don't have the specific prescription ID. Will update the patient's prescriptions. Get this from searchPatientsByName."
              },
              medicationName: {
                type: "string",
                description: isHebrew
                  ? "שם התרופה. אופציונלי - כדי לסנן לתרופה ספציפית כאשר משתמשים ב-patientId"
                  : "OPTIONAL: Medication name. Use with patientId to filter for a specific medication (e.g., 'Empagliflozin'). Case-insensitive partial match."
              },
              updates: {
                type: "object",
                description: isHebrew ? "השדות לעדכון" : "Fields to update",
                properties: {
                  startDate: { type: "string", description: isHebrew ? "תאריך התחלה חדש (ISO format)" : "New start date (ISO format)" },
                  validUntil: { type: "string", description: isHebrew ? "תוקף חדש (ISO format)" : "New expiration date (ISO format)" },
                  medications: { type: "array", description: isHebrew ? "רשימת תרופות מעודכנת" : "Updated medications list" },
                  instructions: { type: "string", description: isHebrew ? "הוראות מעודכנות" : "Updated instructions" },
                  refills: { type: "number", description: isHebrew ? "מספר חזרות מעודכן" : "Updated refills count" },
                  status: { type: "string", description: isHebrew ? "סטטוס מרשם (active/cancelled)" : "Prescription status (active/cancelled)" }
                }
              }
            },
            required: ["updates"]
          }
        },

        // REMOVED: generatePrescription - Gemini-dependent function disabled

{
          name: "updateGuidelineCompliance",
          description: isHebrew ? "עדכן עמידה בהנחיות" : "Update guideline compliance",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              updates: { type: "object", additionalProperties: true }
            },
            required: ["documentId", "updates"]
          }
        },

{
          name: "deleteGuidelineCompliance",
          description: isHebrew ? "מחק בדיקת עמידה" : "Delete compliance check",
          parameters: {
            type: "object",
            properties: { documentId: { type: "string" } },
            required: ["documentId"]
          }
        },

{
          name: "addToGuidelineCompliance",
          description: isHebrew ? "הוסף הנחיה" : "Add guideline",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              fieldName: { type: "string" },
              newItems: { type: "array", items: { type: "object" } }
            },
            required: ["documentId", "fieldName", "newItems"]
          }
        },

{
          name: "refillPrescription",
          description: isHebrew ? "חדש מרשם" : "Refill prescription",
          parameters: {
            type: "object",
            properties: {
              prescriptionId: { type: "string", description: isHebrew ? "מזהה מרשם" : "Prescription ID" },
              quantity: { type: "number", description: isHebrew ? "כמות" : "Quantity" }
            },
            required: ["prescriptionId"]
          }
        },

{
          name: "cancelPrescription",
          description: isHebrew ? "בטל מרשם" : "Cancel prescription",
          parameters: {
            type: "object",
            properties: {
              prescriptionId: { type: "string", description: isHebrew ? "מזהה מרשם" : "Prescription ID" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" }
            },
            required: ["prescriptionId", "reason"]
          }
        },

{
          name: "validatePrescription",
          description: isHebrew ? "אמת מרשם רפואי" : "Validate prescription information",
          parameters: {
            type: "object",
            properties: {
              drugName: { type: "string", description: isHebrew ? "שם התרופה" : "Drug name" },
              ndc: { type: "string", description: isHebrew ? "מספר NDC" : "NDC number" },
              dosage: { type: "string", description: isHebrew ? "מינון" : "Dosage" },
              existingMedications: { 
                type: "array", 
                items: { type: "string" },
                description: isHebrew ? "תרופות קיימות" : "Existing medications" 
              }
            },
            required: ["drugName"]
          }
        },

{
          name: "getCMSRegulatoryUpdates",
          description: isHebrew ? "הצג עדכוני רגולציה CMS" : "Get CMS regulatory updates",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: isHebrew ? "קטגוריה" : "Category" },
              effectiveDate: { type: "string", description: isHebrew ? "תאריך יעילות" : "Effective date" },
              impactLevel: { 
                type: "string", 
                description: isHebrew ? "רמת השפעה" : "Impact level",
                enum: ["LOW", "MEDIUM", "HIGH"]
              },
              limit: { type: "number", description: isHebrew ? "מספר עדכונים" : "Number of updates" }
            }
          }
        },

{
          name: "calculateComplianceScore",
          description: isHebrew ? "חשב ציון ציות רגולטורי" : "Calculate regulatory compliance score",
          parameters: {
            type: "object",
            properties: {
              organizationId: { type: "string", description: isHebrew ? "מזהה ארגון" : "Organization ID" }
            },
            required: ["organizationId"]
          }
        },

{
          name: "generateComplianceReport",
          description: isHebrew ? "צור דוח ציות רגולטורי" : "Generate compliance report",
          parameters: {
            type: "object",
            properties: {
              organizationId: { type: "string", description: isHebrew ? "מזהה ארגון" : "Organization ID" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date" },
              frameworks: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "מסגרות ציות" : "Compliance frameworks"
              },
              includeRecommendations: { type: "boolean", description: isHebrew ? "כלול המלצות" : "Include recommendations" }
            },
            required: ["organizationId"]
          }
        },

{
          name: "setupRegulatoryMonitoring",
          description: isHebrew ? "הגדר ניטור רגולטורי" : "Setup regulatory monitoring",
          parameters: {
            type: "object",
            properties: {
              agencies: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "רשויות רגולטוריות" : "Regulatory agencies"
              },
              categories: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "קטגוריות" : "Categories"
              },
              frequency: { 
                type: "string", 
                description: isHebrew ? "תדירות" : "Frequency",
                enum: ["daily", "weekly", "monthly"]
              }
            },
            required: ["agencies"]
          }
        },

{
          name: "checkRegulatoryCompliance",
          description: isHebrew ? "בדוק עמידה בתקנות FDA/CMS" : "Check FDA/CMS regulatory compliance",
          parameters: {
            type: "object",
            properties: {
              facilityType: {
                type: "string",
                description: isHebrew ? "סוג מתקן" : "Facility type",
                enum: ["hospital", "practice", "pharmacy", "laboratory", "imaging_center"]
              },
              regulations: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "תקנות לבדיקה" : "Regulations to check"
              }
            },
            required: ["facilityType"]
          }
        },

{
          name: "getRegulatoryAlerts",
          description: isHebrew ? "קבל התרעות רגולטוריות עדכניות" : "Get current regulatory alerts",
          parameters: {
            type: "object",
            properties: {
              agencies: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "סוכנויות (FDA, CMS, CDC)" : "Agencies (FDA, CMS, CDC)"
              },
              severity: {
                type: "string",
                description: isHebrew ? "רמת חשיבות" : "Severity level",
                enum: ["critical", "warning", "info", "all"]
              },
              dateRange: { type: "string", description: isHebrew ? "טווח תאריכים" : "Date range" }
            }
          }
        },

{
          name: "getAuditLogs",
          description: isHebrew ? "הצג יומני ביקורת" : "Get audit logs",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              action: { type: "string", description: isHebrew ? "פעולה" : "Action" },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date" }
            }
          }
        },

{
          name: "getSecurityEvents",
          description: isHebrew ? "הצג אירועי אבטחה" : "Get security events",
          parameters: {
            type: "object",
            properties: {
              severity: { type: "string", description: isHebrew ? "חומרה" : "Severity", enum: ["low", "medium", "high", "critical"] },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date" }
            }
          }
        },

{
          name: "exportAuditReport",
          description: isHebrew ? "ייצא דוח ביקורת" : "Export audit report",
          parameters: {
            type: "object",
            properties: {
              format: { type: "string", description: isHebrew ? "פורמט" : "Format", enum: ["pdf", "csv", "json"] },
              dateFrom: { type: "string", description: isHebrew ? "מתאריך" : "From date" },
              dateTo: { type: "string", description: isHebrew ? "עד תאריך" : "To date" }
            },
            required: ["format"]
          }
        },

{
          name: "testDisasterRecovery",
          description: isHebrew ? "בדוק התאוששות מאסון" : "Test disaster recovery",
          parameters: {
            type: "object",
            properties: {
              scenario: { type: "string", description: isHebrew ? "תרחיש" : "Scenario", enum: ["database_failure", "service_outage", "data_corruption"] }
            },
            required: ["scenario"]
          }
        },

{
          name: "getAPIPerformance",
          description: isHebrew ? "הצג ביצועי API" : "Get API performance",
          parameters: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: isHebrew ? "נקודת קצה" : "Endpoint" },
              period: { type: "string", description: isHebrew ? "תקופה" : "Period" }
            }
          }
        },

{
          name: "getCircuitBreakerStatus",
          description: isHebrew ? "הצג סטטוס מפסק זרם" : "Get circuit breaker status",
          parameters: {
            type: "object",
            properties: {
              serviceName: { type: "string", description: isHebrew ? "שם שירות" : "Service name" }
            }
          }
        },

{
          name: "resetCircuitBreaker",
          description: isHebrew ? "אפס מפסק זרם" : "Reset circuit breaker",
          parameters: {
            type: "object",
            properties: {
              serviceName: { type: "string", description: isHebrew ? "שם שירות" : "Service name" }
            },
            required: ["serviceName"]
          }
        },

{
          name: "updateUserPermissions",
          description: isHebrew ? "עדכן הרשאות משתמש" : "Update user permissions",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              permissions: { type: "array", description: isHebrew ? "הרשאות" : "Permissions", items: { type: "string" } }
            },
            required: ["userId", "permissions"]
          }
        },

{
          name: "requestPrescriptionRefill",
          description: isHebrew 
            ? "עבד בקשת חידוש מרשם מהמטופל"
            : "Process prescription refill request from patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              medicationName: { type: "string", description: isHebrew ? "שם התרופה" : "Medication name" },
              prescriptionId: { type: "string", description: isHebrew ? "מזהה מרשם (אופציונלי)" : "Prescription ID (optional)" },
              reason: { type: "string", description: isHebrew ? "סיבת הבקשה" : "Reason for refill" },
              urgentNeed: { type: "boolean", description: isHebrew ? "צורך דחוף" : "Urgent need" }
            },
            required: ["patientId", "medicationName"]
          }
        },

{
          name: "getRoles",
          description: isHebrew ? "קבל רשימת תפקידים" : "Get roles list",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "getUserPermissions",
          description: isHebrew ? "קבל הרשאות משתמש" : "Get user permissions",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" }
            },
            required: ["userId"]
          }
        },

{
          name: "assignRole",
          description: isHebrew ? "הקצה תפקיד למשתמש" : "Assign role to user",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" },
              roleId: { type: "string", description: isHebrew ? "מזהה תפקיד" : "Role ID" }
            },
            required: ["userId", "roleId"]
          }
        },

{
          name: "getThreatLevel",
          description: isHebrew ? "בדוק רמת איום" : "Get threat level",
          parameters: {
            type: "object",
            properties: {
              ipAddress: { type: "string", description: isHebrew ? "כתובת IP" : "IP address" }
            }
          }
        },

{
          name: "blockIP",
          description: isHebrew ? "חסום כתובת IP" : "Block IP address",
          parameters: {
            type: "object",
            properties: {
              ipAddress: { type: "string", description: isHebrew ? "כתובת IP" : "IP address" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" },
              duration: { type: "string", description: isHebrew ? "משך זמן" : "Duration" }
            },
            required: ["ipAddress", "reason"]
          }
        },

{
          name: "unblockIP",
          description: isHebrew ? "בטל חסימת IP" : "Unblock IP address",
          parameters: {
            type: "object",
            properties: {
              ipAddress: { type: "string", description: isHebrew ? "כתובת IP" : "IP address" }
            },
            required: ["ipAddress"]
          }
        },

{
          name: "getEncryptionKeys",
          description: isHebrew ? "קבל מפתחות הצפנה" : "Get encryption keys",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" }
            }
          }
        },

{
          name: "rotateEncryptionKeys",
          description: isHebrew ? "החלף מפתחות הצפנה" : "Rotate encryption keys",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה משתמש" : "User ID" }
            },
            required: ["userId"]
          }
        },

{
          name: "updateCSPPolicy",
          description: isHebrew ? "עדכן מדיניות CSP" : "Update CSP policy",
          parameters: {
            type: "object",
            properties: {
              directive: { type: "string", description: isHebrew ? "הנחיה" : "Directive" },
              sources: { type: "array", description: isHebrew ? "מקורות" : "Sources", items: { type: "string" } }
            },
            required: ["directive", "sources"]
          }
        },

{
          name: "getSecurityHeaders",
          description: isHebrew ? "קבל כותרות אבטחה" : "Get security headers",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "updateSecurityHeader",
          description: isHebrew ? "עדכן כותרת אבטחה" : "Update security header",
          parameters: {
            type: "object",
            properties: {
              headerName: { type: "string", description: isHebrew ? "שם כותרת" : "Header name" },
              value: { type: "string", description: isHebrew ? "ערך" : "Value" }
            },
            required: ["headerName", "value"]
          }
        },

{
          name: "getComplianceStatus",
          description: isHebrew ? "קבל סטטוס ציות" : "Get compliance status",
          parameters: {
            type: "object",
            properties: {
              standard: { type: "string", description: isHebrew ? "תקן" : "Standard", enum: ["HIPAA", "GDPR", "PCI-DSS", "SOC2"] }
            }
          }
        },

{
          name: "generateComplianceReportDetailed",
          description: isHebrew ? "צור דוח ציות מפורט" : "Generate detailed compliance report",
          parameters: {
            type: "object",
            properties: {
              standard: { type: "string", description: isHebrew ? "תקן" : "Standard", enum: ["HIPAA", "GDPR", "PCI-DSS", "SOC2"] },
              includeEvidence: { type: "boolean", description: isHebrew ? "כלול ראיות" : "Include evidence" },
              format: { type: "string", description: isHebrew ? "פורמט" : "Format", enum: ["pdf", "html", "json"] }
            },
            required: ["standard"]
          }
        },

{
          name: "scheduleComplianceAudit",
          description: isHebrew ? "תזמן ביקורת ציות" : "Schedule compliance audit",
          parameters: {
            type: "object",
            properties: {
              auditType: { type: "string", description: isHebrew ? "סוג ביקורת" : "Audit type" },
              scheduledDate: { type: "string", description: isHebrew ? "תאריך מתוזמן" : "Scheduled date" },
              scope: { type: "array", description: isHebrew ? "היקף" : "Scope", items: { type: "string" } }
            },
            required: ["auditType", "scheduledDate"]
          }
        },

{
          name: "setupMultipleDoctors",
          description: isHebrew ? "הגדר מספר משתמשים כספקי שירות בבת אחת - אידיאלי לרופאים שנרשמו כסגל רגיל" : "Set up multiple users as providers at once - ideal for doctors who registered as regular staff",
          parameters: {
            type: "object",
            properties: {
              users: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת אימיילים או מזהי משתמשים" : "List of emails or user IDs" },
              updateRole: { type: "boolean", description: isHebrew ? "האם לעדכן תפקיד לרופא" : "Whether to update role to doctor" },
              role: { type: "string", description: isHebrew ? "התפקיד החדש (doctor כברירת מחדל)" : "New role (defaults to doctor)", enum: ["doctor", "nurse", "technician"] },
              appointmentDuration: { type: "number", description: isHebrew ? "משך פגישה בדקות" : "Appointment duration in minutes" },
              specialties: { type: "array", items: { type: "string" }, description: isHebrew ? "התמחויות לכל המשתמשים" : "Specialties for all users" },
              departments: { type: "array", items: { type: "string" }, description: isHebrew ? "מחלקות לכל המשתמשים" : "Departments for all users" }
            },
            required: ["users"]
          }
        },

{
          name: "bulkUpdateRoles",
          description: isHebrew ? "עדכן תפקידים למספר משתמשים בבת אחת" : "Update roles for multiple users at once",
          parameters: {
            type: "object",
            properties: {
              users: { type: "array", items: { type: "string" }, description: isHebrew ? "רשימת אימיילים או מזהי משתמשים" : "List of emails or user IDs" },
              newRole: { type: "string", description: isHebrew ? "התפקיד החדש" : "New role", enum: ["admin", "doctor", "nurse", "receptionist", "technician", "staff"] }
            },
            required: ["users", "newRole"]
          }
        },

{
          name: "getSecurityDashboard",
          description: isHebrew ? "קבל לוח בקרת אבטחה" : "Get security dashboard",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "getSecurityAlerts",
          description: isHebrew ? "קבל התראות אבטחה" : "Get security alerts",
          parameters: {
            type: "object",
            properties: {
              severity: { type: "string", description: isHebrew ? "חומרה" : "Severity", enum: ["low", "medium", "high", "critical"] },
              status: { type: "string", description: isHebrew ? "סטטוס" : "Status", enum: ["open", "acknowledged", "resolved"] }
            }
          }
        },

{
          name: "acknowledgeSecurityAlert",
          description: isHebrew ? "אשר התראת אבטחה" : "Acknowledge security alert",
          parameters: {
            type: "object",
            properties: {
              alertId: { type: "string", description: isHebrew ? "מזהה התראה" : "Alert ID" },
              notes: { type: "string", description: isHebrew ? "הערות" : "Notes" }
            },
            required: ["alertId"]
          }
        },

{
          name: "getSecurityMetrics",
          description: isHebrew ? "קבל מטריקות אבטחה" : "Get security metrics",
          parameters: {
            type: "object",
            properties: {
              metricType: { type: "string", description: isHebrew ? "סוג מטריקה" : "Metric type" },
              timeRange: { type: "string", description: isHebrew ? "טווח זמן" : "Time range", enum: ["1h", "6h", "24h", "7d", "30d"] }
            }
          }
        },

{
          name: "getAllCircuitBreakers",
          description: isHebrew ? "קבל כל מנתקי הזרם" : "Get all circuit breakers",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "forceOpenCircuitBreaker",
          description: isHebrew ? "פתח מנתק זרם" : "Force open circuit breaker",
          parameters: {
            type: "object",
            properties: {
              serviceName: { type: "string", description: isHebrew ? "שם שירות" : "Service name" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" }
            },
            required: ["serviceName", "reason"]
          }
        },

{
          name: "getCircuitBreakerHistory",
          description: isHebrew ? "קבל היסטוריית מנתק זרם" : "Get circuit breaker history",
          parameters: {
            type: "object",
            properties: {
              serviceName: { type: "string", description: isHebrew ? "שם שירות" : "Service name" },
              limit: { type: "number", description: isHebrew ? "מגבלה" : "Limit" }
            },
            required: ["serviceName"]
          }
        },

{
          name: "getDisasterRecoveryStatus",
          description: isHebrew ? "קבל סטטוס התאוששות" : "Get disaster recovery status",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "getDetailedSecurityMetrics",
          description: isHebrew ? "קבל מטריקות אבטחה מפורטות" : "Get detailed security metrics",
          parameters: {
            type: "object",
            properties: {
              includeHistory: { type: "boolean", description: isHebrew ? "כלול היסטוריה" : "Include history" }
            }
          }
        },

{
          name: "getThreatReport",
          description: isHebrew ? "קבל דוח איומים" : "Get threat report",
          parameters: {
            type: "object",
            properties: {
              timeRange: { type: "string", description: isHebrew ? "טווח זמן" : "Time range", enum: ["24h", "7d", "30d"] }
            }
          }
        },

{
          name: "emitSecurityEvent",
          description: isHebrew ? "שלח אירוע אבטחה" : "Emit security event",
          parameters: {
            type: "object",
            properties: {
              eventType: { type: "string", description: isHebrew ? "סוג אירוע" : "Event type" },
              severity: { type: "string", description: isHebrew ? "חומרה" : "Severity", enum: ["low", "medium", "high", "critical"] },
              details: { type: "object", description: isHebrew ? "פרטים" : "Details" }
            },
            required: ["eventType", "severity"]
          }
        },

{
          name: "blacklistIP",
          description: isHebrew ? "הוסף IP לרשימה שחורה" : "Blacklist IP",
          parameters: {
            type: "object",
            properties: {
              ipAddress: { type: "string", description: isHebrew ? "כתובת IP" : "IP address" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason" },
              duration: { type: "string", description: isHebrew ? "משך זמן" : "Duration" }
            },
            required: ["ipAddress", "reason"]
          }
        },

{
          name: "checkIPReputation",
          description: isHebrew ? "בדוק מוניטין IP" : "Check IP reputation",
          parameters: {
            type: "object",
            properties: {
              ipAddress: { type: "string", description: isHebrew ? "כתובת IP" : "IP address" }
            },
            required: ["ipAddress"]
          }
        },

{
          name: "updateSecurityThresholds",
          description: isHebrew ? "עדכן ספי אבטחה" : "Update security thresholds",
          parameters: {
            type: "object",
            properties: {
              thresholds: { type: "object", description: isHebrew ? "ספים" : "Thresholds" }
            },
            required: ["thresholds"]
          }
        },

{
          name: "getSecurityEventTypes",
          description: isHebrew ? "קבל סוגי אירועי אבטחה" : "Get security event types",
          parameters: {
            type: "object",
            properties: {}
          }
        },

{
          name: "getRecentSecurityEvents",
          description: isHebrew ? "קבל אירועי אבטחה אחרונים" : "Get recent security events",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: isHebrew ? "מגבלה" : "Limit" },
              eventType: { type: "string", description: isHebrew ? "סוג אירוע" : "Event type" }
            }
          }
        },

{
          name: "getClinicPermissions",
          description: isHebrew ? "קבל הרשאות מרפאה" : "Get practice permissions",
          parameters: {
            type: "object",
            properties: {
              practiceId: { type: "string", description: isHebrew ? "מזהה מרפאה" : "Practice ID" }
            },
            required: ["practiceId"]
          }
        },

{
          name: "encryptData",
          description: isHebrew ? "הצפן נתונים" : "Encrypt data",
          parameters: {
            type: "object",
            properties: {
              data: { type: "string", description: isHebrew ? "נתונים" : "Data" },
              recipientId: { type: "string", description: isHebrew ? "מזהה מקבל" : "Recipient ID" }
            },
            required: ["data", "recipientId"]
          }
        },

{
          name: "decryptData",
          description: isHebrew ? "פענח נתונים" : "Decrypt data",
          parameters: {
            type: "object",
            properties: {
              encryptedData: { type: "string", description: isHebrew ? "נתונים מוצפנים" : "Encrypted data" },
              keyId: { type: "string", description: isHebrew ? "מזהה מפתח" : "Key ID" }
            },
            required: ["encryptedData"]
          }
        },

{
          name: "shareEncryptedDocument",
          description: isHebrew ? "שתף מסמך מוצפן" : "Share encrypted document",
          parameters: {
            type: "object",
            properties: {
              documentId: { type: "string", description: isHebrew ? "מזהה מסמך" : "Document ID" },
              recipientIds: { type: "array", description: isHebrew ? "מזהי מקבלים" : "Recipient IDs", items: { type: "string" } },
              permissions: { type: "array", description: isHebrew ? "הרשאות" : "Permissions", items: { type: "string" } }
            },
            required: ["documentId", "recipientIds"]
          }
        },

{
          name: "blockDoctorTime",
          description: isHebrew ? "חסום זמן של ספק (חופשה, כנס, וכו')" : "Block provider time (vacation, conference, etc.)",
          parameters: {
            type: "object",
            properties: {
              providerId: { type: "string", description: isHebrew ? "מזהה ספק" : "Provider ID" },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              reason: { type: "string", description: isHebrew ? "סיבה" : "Reason", enum: ["vacation", "conference", "sick", "personal", "training", "other"] },
              description: { type: "string", description: isHebrew ? "תיאור" : "Description" }
            },
            required: ["providerId", "startDate", "endDate"]
          }
        },

{
          name: "recordConsent",
          description: isHebrew ? "רישום הסכמת מטופל חדשה לשיתוף נתונים HIPAA" : "Record new patient consent for HIPAA data sharing",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              consentType: {
                type: "string",
                enum: ["DATA_SHARING", "RESEARCH", "MARKETING", "EMERGENCY_ACCESS"],
                description: isHebrew ? "סוג ההסכמה" : "Type of consent"
              },
              scope: { type: "string", description: isHebrew ? "היקף ההסכמה (מסמכים ספציפיים, כל הנתונים, וכו')" : "Scope of consent (specific documents, all data, etc.)" },
              expirationDate: { type: "string", description: isHebrew ? "תאריך תפוגה (YYYY-MM-DD)" : "Expiration date (YYYY-MM-DD)" }
            },
            required: ["patientId", "consentType"]
          }
        },

{
          name: "updateConsent",
          description: isHebrew ? "עדכון הסכמת מטופל קיימת" : "Update existing patient consent",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              consentId: { type: "string", description: isHebrew ? "מזהה ההסכמה לעדכון" : "Consent ID to update" },
              consentType: {
                type: "string",
                enum: ["DATA_SHARING", "RESEARCH", "MARKETING", "EMERGENCY_ACCESS"],
                description: isHebrew ? "סוג ההסכמה המעודכן" : "Updated consent type"
              },
              scope: { type: "string", description: isHebrew ? "היקף ההסכמה המעודכן" : "Updated scope of consent" },
              expirationDate: { type: "string", description: isHebrew ? "תאריך תפוגה מעודכן" : "Updated expiration date" }
            },
            required: ["patientId", "consentId"]
          }
        },

{
          name: "revokeConsent",
          description: isHebrew ? "ביטול הסכמת מטופל לשיתוף נתונים" : "Revoke patient consent for data sharing",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              consentId: { type: "string", description: isHebrew ? "מזהה ההסכמה לביטול" : "Consent ID to revoke" },
              reason: { type: "string", description: isHebrew ? "סיבת הביטול" : "Reason for revocation" }
            },
            required: ["patientId", "consentId"]
          }
        },

{
          name: "getPatientConsents",
          description: isHebrew ? "הצג כל ההסכמות של מטופל" : "Get all consents for a patient",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              activeOnly: { type: "boolean", description: isHebrew ? "הצג רק הסכמות פעילות" : "Show only active consents" }
            },
            required: ["patientId"]
          }
        },

{
          name: "checkConsentStatus",
          description: isHebrew ? "בדוק סטטוס הסכמה לפעולה ספציפית" : "Check consent status for specific action",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              action: { type: "string", description: isHebrew ? "הפעולה לבדיקה (שיתוף נתונים, מחקר, וכו')" : "Action to check (data sharing, research, etc.)" },
              requestorId: { type: "string", description: isHebrew ? "מזהה המבקש" : "Requestor ID" }
            },
            required: ["patientId", "action"]
          }
        },

{
          name: "anonymizePatientData",
          description: isHebrew ? "אנונימיזציה של נתוני מטופל לפי HIPAA Safe Harbor" : "Anonymize patient data per HIPAA Safe Harbor",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              dataTypes: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "סוגי נתונים לאנונימיזציה (demographics, past_medical_history, labs)" : "Data types to anonymize (demographics, past_medical_history, labs)"
              },
              purpose: { type: "string", description: isHebrew ? "מטרת האנונימיזציה (מחקר, ניתוח, וכו')" : "Purpose of anonymization (research, analysis, etc.)" }
            },
            required: ["patientId", "dataTypes", "purpose"]
          }
        },

{
          name: "exportAnonymizedData",
          description: isHebrew ? "ייצוא נתונים אנונימיים למחקר" : "Export anonymized data for research",
          parameters: {
            type: "object",
            properties: {
              criteria: { type: "object", description: isHebrew ? "קריטריונים לבחירת נתונים" : "Criteria for data selection" },
              format: { 
                type: "string", 
                enum: ["JSON", "CSV", "XLSX"],
                description: isHebrew ? "פורמט הייצוא" : "Export format" 
              },
              includeFields: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "שדות לכלול בייצוא" : "Fields to include in export"
              }
            },
            required: ["criteria", "format"]
          }
        },

{
          name: "reIdentifyData",
          description: isHebrew ? "שחזור זהות נתונים אנונימיים (למורשים בלבד)" : "Re-identify anonymized data (authorized only)",
          parameters: {
            type: "object",
            properties: {
              anonymizedId: { type: "string", description: isHebrew ? "מזהה אנונימי" : "Anonymized ID" },
              authorizationCode: { type: "string", description: isHebrew ? "קוד הרשאה מיוחד" : "Special authorization code" },
              reason: { type: "string", description: isHebrew ? "סיבה לשחזור הזהות" : "Reason for re-identification" }
            },
            required: ["anonymizedId", "authorizationCode", "reason"]
          }
        },

{
          name: "scheduleDataRetention",
          description: isHebrew ? "תזמון מחיקת נתונים אוטומטית לפי HIPAA" : "Schedule automatic HIPAA data cleanup",
          parameters: {
            type: "object",
            properties: {
              retentionType: {
                type: "string",
                enum: ["MEDICAL_RECORDS", "AUDIT_LOGS", "LAB_RESULTS", "IMAGING", "BILLING"],
                description: isHebrew ? "סוג הנתונים למחיקה" : "Type of data to retain"
              },
              retentionPeriod: { type: "number", description: isHebrew ? "תקופת שמירה בשנים" : "Retention period in years" },
              schedule: { type: "string", description: isHebrew ? "תזמון (daily/weekly/monthly)" : "Schedule (daily/weekly/monthly)" }
            },
            required: ["retentionType", "retentionPeriod"]
          }
        },

{
          name: "executeDataRetention",
          description: isHebrew ? "הרצת מדיניות שמירת נתונים כעת" : "Run data retention policy now",
          parameters: {
            type: "object",
            properties: {
              retentionType: {
                type: "string",
                enum: ["MEDICAL_RECORDS", "AUDIT_LOGS", "LAB_RESULTS", "IMAGING", "BILLING"],
                description: isHebrew ? "סוג הנתונים למחיקה" : "Type of data to clean"
              },
              dryRun: { type: "boolean", description: isHebrew ? "סימולציה בלבד" : "Dry run only" }
            },
            required: ["retentionType"]
          }
        },

{
          name: "getRetentionPolicy",
          description: isHebrew ? "קבלת הגדרות שמירת נתונים נוכחיות" : "Get current retention policy settings",
          parameters: {
            type: "object",
            properties: {
              retentionType: { type: "string", description: isHebrew ? "סוג הנתונים (אופציונלי)" : "Data type (optional)" }
            }
          }
        },

{
          name: "updateRetentionPolicy",
          description: isHebrew ? "עדכון מדיניות שמירת נתונים" : "Update data retention policy",
          parameters: {
            type: "object",
            properties: {
              retentionType: {
                type: "string",
                enum: ["MEDICAL_RECORDS", "AUDIT_LOGS", "LAB_RESULTS", "IMAGING", "BILLING"],
                description: isHebrew ? "סוג הנתונים" : "Data type"
              },
              retentionPeriod: { type: "number", description: isHebrew ? "תקופת שמירה בשנים" : "Retention period in years" },
              autoDelete: { type: "boolean", description: isHebrew ? "מחיקה אוטומטית" : "Auto-delete enabled" }
            },
            required: ["retentionType", "retentionPeriod"]
          }
        },

{
          name: "getRetentionHistory",
          description: isHebrew ? "היסטוריית מחיקות נתונים" : "View data deletion history",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            }
          }
        },

{
          name: "generateAuditReport",
          description: isHebrew ? "יצירת דוח ביקורת HIPAA" : "Generate HIPAA audit trail report",
          parameters: {
            type: "object",
            properties: {
              reportType: {
                type: "string",
                enum: ["ACCESS", "MODIFICATIONS", "DELETIONS", "BREACHES", "CONSENT", "FULL"],
                description: isHebrew ? "סוג הדוח" : "Report type"
              },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)" }
            },
            required: ["reportType"]
          }
        },

{
          name: "exportAuditData",
          description: isHebrew ? "ייצוא נתוני ביקורת לרגולטורים" : "Export audit data for regulators",
          parameters: {
            type: "object",
            properties: {
              format: {
                type: "string",
                enum: ["PDF", "CSV", "JSON", "XML"],
                description: isHebrew ? "פורמט הייצוא" : "Export format"
              },
              dataTypes: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "סוגי נתונים לייצוא" : "Data types to export"
              },
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              encrypt: { type: "boolean", description: isHebrew ? "הצפנת הקובץ" : "Encrypt file" }
            },
            required: ["format", "dataTypes"]
          }
        },

{
          name: "scheduleComplianceReports",
          description: isHebrew ? "תזמון דוחות תאימות אוטומטיים" : "Schedule automatic compliance reports",
          parameters: {
            type: "object",
            properties: {
              reportType: {
                type: "string",
                enum: ["HIPAA", "GDPR", "AUDIT", "ACCESS", "BREACH"],
                description: isHebrew ? "סוג הדוח" : "Report type"
              },
              frequency: {
                type: "string",
                enum: ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
                description: isHebrew ? "תדירות" : "Frequency"
              },
              recipients: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "נמענים" : "Recipients"
              }
            },
            required: ["reportType", "frequency", "recipients"]
          }
        },

{
          name: "submitAccessRequest",
          description: isHebrew ? "הגשת בקשת גישה לרשומות מטופל" : "Submit patient records access request",
          parameters: {
            type: "object",
            properties: {
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל" : "Patient ID" },
              requestType: {
                type: "string",
                enum: ["VIEW", "DOWNLOAD", "SHARE", "CORRECT", "DELETE"],
                description: isHebrew ? "סוג הבקשה" : "Request type"
              },
              reason: { type: "string", description: isHebrew ? "סיבת הבקשה" : "Request reason" },
              recordTypes: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "סוגי רשומות" : "Record types"
              }
            },
            required: ["patientId", "requestType", "reason"]
          }
        },

{
          name: "approveAccessRequest",
          description: isHebrew ? "אישור בקשת גישה" : "Approve access request",
          parameters: {
            type: "object",
            properties: {
              requestId: { type: "string", description: isHebrew ? "מזהה בקשה" : "Request ID" },
              approvalNotes: { type: "string", description: isHebrew ? "הערות אישור" : "Approval notes" },
              expirationDate: { type: "string", description: isHebrew ? "תאריך תפוגה" : "Expiration date" }
            },
            required: ["requestId"]
          }
        },

{
          name: "denyAccessRequest",
          description: isHebrew ? "דחיית בקשת גישה" : "Deny access request",
          parameters: {
            type: "object",
            properties: {
              requestId: { type: "string", description: isHebrew ? "מזהה בקשה" : "Request ID" },
              denialReason: {
                type: "string",
                enum: ["INCOMPLETE", "UNAUTHORIZED", "PRIVACY", "LEGAL", "OTHER"],
                description: isHebrew ? "סיבת דחייה" : "Denial reason"
              },
              explanation: { type: "string", description: isHebrew ? "הסבר מפורט" : "Detailed explanation" }
            },
            required: ["requestId", "denialReason"]
          }
        },

{
          name: "fulfillAccessRequest",
          description: isHebrew ? "מסירת רשומות למבקש" : "Deliver requested records",
          parameters: {
            type: "object",
            properties: {
              requestId: { type: "string", description: isHebrew ? "מזהה בקשה" : "Request ID" },
              deliveryMethod: {
                type: "string",
                enum: ["EMAIL", "PORTAL", "MAIL", "IN_PERSON"],
                description: isHebrew ? "אופן מסירה" : "Delivery method"
              },
              encryptionRequired: { type: "boolean", description: isHebrew ? "דרושה הצפנה" : "Encryption required" }
            },
            required: ["requestId", "deliveryMethod"]
          }
        },

{
          name: "getAccessRequests",
          description: isHebrew ? "רשימת בקשות גישה ממתינות" : "List pending access requests",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["PENDING", "APPROVED", "DENIED", "FULFILLED", "ALL"],
                description: isHebrew ? "סטטוס בקשה" : "Request status"
              },
              patientId: { type: "string", description: isHebrew ? "מזהה מטופל (אופציונלי)" : "Patient ID (optional)" },
              limit: { type: "number", description: isHebrew ? "מספר תוצאות" : "Number of results" }
            }
          }
        },

{
          name: "trackAccessDelivery",
          description: isHebrew ? "מעקב אחר מסירת רשומות" : "Track record delivery status",
          parameters: {
            type: "object",
            properties: {
              requestId: { type: "string", description: isHebrew ? "מזהה בקשה" : "Request ID" }
            },
            required: ["requestId"]
          }
        },

{
          name: "reportBreach",
          description: isHebrew ? "דיווח על הפרת HIPAA פוטנציאלית" : "Report potential HIPAA breach",
          parameters: {
            type: "object",
            properties: {
              breachType: {
                type: "string",
                enum: ["UNAUTHORIZED_ACCESS", "DATA_LOSS", "THEFT", "HACKING", "IMPROPER_DISPOSAL", "OTHER"],
                description: isHebrew ? "סוג ההפרה" : "Breach type"
              },
              affectedRecords: { type: "number", description: isHebrew ? "מספר רשומות מושפעות" : "Number of affected records" },
              discoveryDate: { type: "string", description: isHebrew ? "תאריך גילוי" : "Discovery date" },
              description: { type: "string", description: isHebrew ? "תיאור האירוע" : "Event description" }
            },
            required: ["breachType", "affectedRecords", "discoveryDate", "description"]
          }
        },

{
          name: "assessBreachRisk",
          description: isHebrew ? "הערכת חומרת הפרת HIPAA" : "Assess HIPAA breach severity",
          parameters: {
            type: "object",
            properties: {
              breachId: { type: "string", description: isHebrew ? "מזהה הפרה" : "Breach ID" },
              dataTypes: {
                type: "array",
                items: { type: "string" },
                description: isHebrew ? "סוגי נתונים שנחשפו" : "Exposed data types"
              },
              mitigation: { type: "string", description: isHebrew ? "צעדי מיתון" : "Mitigation steps" }
            },
            required: ["breachId"]
          }
        },

{
          name: "generateBreachReport",
          description: isHebrew ? "יצירת דוח הפרה ל-HHS" : "Generate HHS breach report",
          parameters: {
            type: "object",
            properties: {
              breachId: { type: "string", description: isHebrew ? "מזהה הפרה" : "Breach ID" },
              reportFormat: {
                type: "string",
                enum: ["HHS_STANDARD", "STATE_SPECIFIC", "INTERNAL"],
                description: isHebrew ? "פורמט הדוח" : "Report format"
              }
            },
            required: ["breachId", "reportFormat"]
          }
        },

{
          name: "getBreachHistory",
          description: isHebrew ? "היסטוריית הפרות HIPAA" : "View HIPAA breach history",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              severity: {
                type: "string",
                enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "ALL"],
                description: isHebrew ? "חומרת הפרה" : "Breach severity"
              }
            }
          }
        },

{
          name: "assessVendorRisk",
          description: isHebrew ? "הערך סיכון ספק לציות HIPAA" : "Assess vendor HIPAA compliance risk",
          parameters: {
            type: "object",
            properties: {
              vendorName: { type: "string", description: isHebrew ? "שם הספק" : "Vendor name" },
              vendorType: { 
                type: "string", 
                enum: ["EHR_VENDOR", "LAB_VENDOR", "IMAGING_VENDOR", "PHARMACY_VENDOR", "BILLING_VENDOR", "OTHER"],
                description: isHebrew ? "סוג הספק" : "Vendor type" 
              },
              services: { type: "array", items: { type: "string" }, description: isHebrew ? "שירותים מסופקים" : "Services provided" },
              hasBAA: { type: "boolean", description: isHebrew ? "האם יש הסכם שותף עסקי" : "Has Business Associate Agreement" },
              securityMeasures: { type: "object", description: isHebrew ? "אמצעי אבטחה" : "Security measures" },
              lastAuditDate: { type: "string", description: isHebrew ? "תאריך ביקורת אחרון" : "Last audit date" }
            },
            required: ["vendorName", "vendorType", "hasBAA"]
          }
        },

{
          name: "updateBAAgreement",
          description: isHebrew ? "עדכן הסכם שותף עסקי" : "Update Business Associate Agreement",
          parameters: {
            type: "object",
            properties: {
              vendorId: { type: "string", description: isHebrew ? "מזהה הספק" : "Vendor ID" },
              updates: {
                type: "object",
                description: isHebrew ? "עדכונים להסכם" : "Agreement updates",
                properties: {
                  expirationDate: { type: "string", description: isHebrew ? "תאריך סיום חדש" : "New expiration date" },
                  subcontractorAllowed: { type: "boolean", description: isHebrew ? "האם מותר קבלני משנה" : "Subcontractor allowed" },
                  additionalTerms: { type: "string", description: isHebrew ? "תנאים נוספים" : "Additional terms" }
                }
              }
            },
            required: ["vendorId", "updates"]
          }
        },

{
          name: "getVendorCompliance",
          description: isHebrew ? "בדוק סטטוס ציות של ספק" : "Check vendor compliance status",
          parameters: {
            type: "object",
            properties: {
              vendorId: { type: "string", description: isHebrew ? "מזהה הספק" : "Vendor ID" }
            },
            required: ["vendorId"]
          }
        },

{
          name: "auditVendor",
          description: isHebrew ? "בצע ביקורת ספק" : "Perform vendor audit",
          parameters: {
            type: "object",
            properties: {
              vendorId: { type: "string", description: isHebrew ? "מזהה הספק" : "Vendor ID" },
              auditType: { 
                type: "string",
                enum: ["SECURITY", "COMPLIANCE", "COMPREHENSIVE", "INCIDENT_RESPONSE"],
                description: isHebrew ? "סוג הביקורת" : "Audit type"
              },
              findings: { type: "object", description: isHebrew ? "ממצאי הביקורת" : "Audit findings" },
              recommendations: { type: "array", items: { type: "string" }, description: isHebrew ? "המלצות" : "Recommendations" }
            },
            required: ["vendorId", "auditType", "findings"]
          }
        },

{
          name: "getVendorList",
          description: isHebrew ? "קבל רשימת כל השותפים העסקיים" : "List all business associates",
          parameters: {
            type: "object",
            properties: {
              filters: {
                type: "object",
                description: isHebrew ? "סינון" : "Filters",
                properties: {
                  type: { type: "string", description: isHebrew ? "סוג הספק" : "Vendor type" },
                  hasActiveBAA: { type: "boolean", description: isHebrew ? "רק עם הסכם פעיל" : "Only with active BAA" },
                  complianceStatus: { type: "string", description: isHebrew ? "סטטוס ציות" : "Compliance status" }
                }
              }
            }
          }
        },

{
          name: "getPolicy",
          description: isHebrew ? "קבל מדיניות ספציפית" : "Retrieve specific policy",
          parameters: {
            type: "object",
            properties: {
              policyId: { type: "string", description: isHebrew ? "מזהה המדיניות" : "Policy ID" }
            },
            required: ["policyId"]
          }
        },

{
          name: "acknowledgePolicy",
          description: isHebrew ? "אשר קריאת מדיניות" : "Staff acknowledges policy",
          parameters: {
            type: "object",
            properties: {
              policyId: { type: "string", description: isHebrew ? "מזהה המדיניות" : "Policy ID" },
              userId: { type: "string", description: isHebrew ? "מזהה המשתמש" : "User ID" },
              acknowledgmentType: {
                type: "string",
                enum: ["READ", "READ_AND_UNDERSTOOD", "TRAINED"],
                description: isHebrew ? "סוג האישור" : "Acknowledgment type"
              },
              signature: { type: "string", description: isHebrew ? "חתימה דיגיטלית" : "Digital signature" }
            },
            required: ["policyId", "acknowledgmentType"]
          }
        },

{
          name: "getPolicyCompliance",
          description: isHebrew ? "בדוק אישורי מדיניות" : "Check policy acknowledgments",
          parameters: {
            type: "object",
            properties: {
              policyId: { type: "string", description: isHebrew ? "מזהה המדיניות" : "Policy ID" }
            },
            required: ["policyId"]
          }
        },

{
          name: "reportIncident",
          description: isHebrew ? "דווח על אירוע אבטחה או הפרת HIPAA" : "Report security incident or HIPAA breach",
          parameters: {
            type: "object",
            properties: {
              type: { 
                type: "string", 
                enum: ["DATA_BREACH", "UNAUTHORIZED_ACCESS", "LOST_DEVICE", "MALWARE", "PHISHING", "OTHER"],
                description: isHebrew ? "סוג האירוע" : "Incident type" 
              },
              severity: { 
                type: "string", 
                enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
                description: isHebrew ? "חומרת האירוע" : "Incident severity" 
              },
              description: { type: "string", description: isHebrew ? "תיאור האירוע" : "Incident description" },
              affectedPatients: { type: "array", items: { type: "string" }, description: isHebrew ? "מטופלים מושפעים" : "Affected patients" },
              dateOccurred: { type: "string", description: isHebrew ? "תאריך האירוע (YYYY-MM-DD)" : "Date occurred (YYYY-MM-DD)" }
            },
            required: ["type", "severity", "description", "dateOccurred"]
          }
        },

{
          name: "investigateIncident",
          description: isHebrew ? "התחל חקירת אירוע אבטחה" : "Start incident investigation",
          parameters: {
            type: "object",
            properties: {
              incidentId: { type: "string", description: isHebrew ? "מזהה אירוע" : "Incident ID" },
              investigator: { type: "string", description: isHebrew ? "שם החוקר" : "Investigator name" },
              initialFindings: { type: "string", description: isHebrew ? "ממצאים ראשוניים" : "Initial findings" }
            },
            required: ["incidentId", "investigator"]
          }
        },

{
          name: "escalateIncident",
          description: isHebrew ? "הסלם אירוע להנהלה" : "Escalate incident to management",
          parameters: {
            type: "object",
            properties: {
              incidentId: { type: "string", description: isHebrew ? "מזהה אירוע" : "Incident ID" },
              escalationLevel: { 
                type: "string", 
                enum: ["SUPERVISOR", "MANAGEMENT", "EXECUTIVE", "BOARD", "EXTERNAL"],
                description: isHebrew ? "רמת הסלמה" : "Escalation level" 
              },
              reason: { type: "string", description: isHebrew ? "סיבת ההסלמה" : "Escalation reason" },
              urgency: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "IMMEDIATE"], description: isHebrew ? "דחיפות" : "Urgency" }
            },
            required: ["incidentId", "escalationLevel", "reason"]
          }
        },

{
          name: "resolveIncident",
          description: isHebrew ? "סמן אירוע כפתור" : "Mark incident as resolved",
          parameters: {
            type: "object",
            properties: {
              incidentId: { type: "string", description: isHebrew ? "מזהה אירוע" : "Incident ID" },
              resolution: { type: "string", description: isHebrew ? "תיאור הפתרון" : "Resolution description" },
              preventiveMeasures: { type: "string", description: isHebrew ? "צעדי מניעה" : "Preventive measures" },
              lessonsLearned: { type: "string", description: isHebrew ? "לקחים שנלמדו" : "Lessons learned" }
            },
            required: ["incidentId", "resolution"]
          }
        },

{
          name: "getIncidentStatus",
          description: isHebrew ? "בדוק סטטוס אירוע" : "Check incident status",
          parameters: {
            type: "object",
            properties: {
              incidentId: { type: "string", description: isHebrew ? "מזהה אירוע" : "Incident ID" }
            },
            required: ["incidentId"]
          }
        },

{
          name: "generateIncidentReport",
          description: isHebrew ? "צור דוח אירוע מפורט" : "Generate detailed incident report",
          parameters: {
            type: "object",
            properties: {
              incidentId: { type: "string", description: isHebrew ? "מזהה אירוע" : "Incident ID" },
              format: { type: "string", enum: ["PDF", "JSON", "HTML"], description: isHebrew ? "פורמט הדוח" : "Report format" },
              includeTimeline: { type: "boolean", description: isHebrew ? "כלול ציר זמן" : "Include timeline" },
              includeForensics: { type: "boolean", description: isHebrew ? "כלול ניתוח פורנזי" : "Include forensics" }
            },
            required: ["incidentId"]
          }
        },

{
          name: "performRiskAssessment",
          description: isHebrew ? "בצע הערכת סיכונים אבטחתיים" : "Conduct security risk assessment",
          parameters: {
            type: "object",
            properties: {
              assessmentType: { 
                type: "string", 
                enum: ["TECHNICAL", "PHYSICAL", "ADMINISTRATIVE", "COMPREHENSIVE"],
                description: isHebrew ? "סוג הערכה" : "Assessment type" 
              },
              scope: { type: "string", description: isHebrew ? "היקף ההערכה" : "Assessment scope" },
              systems: { type: "array", items: { type: "string" }, description: isHebrew ? "מערכות להערכה" : "Systems to assess" }
            },
            required: ["assessmentType", "scope"]
          }
        },

{
          name: "generateRiskReport",
          description: isHebrew ? "צור דוח הערכת סיכונים" : "Generate risk assessment report",
          parameters: {
            type: "object",
            properties: {
              assessmentId: { type: "string", description: isHebrew ? "מזהה הערכה" : "Assessment ID" },
              includeRecommendations: { type: "boolean", description: isHebrew ? "כלול המלצות" : "Include recommendations" },
              executiveSummary: { type: "boolean", description: isHebrew ? "סיכום מנהלים" : "Executive summary" },
              format: { type: "string", enum: ["PDF", "JSON", "HTML"], description: isHebrew ? "פורמט" : "Format" }
            },
            required: ["assessmentId"]
          }
        },

{
          name: "trackCertification",
          description: isHebrew
            ? "מעקב אחר הסמכה מקצועית עם תאריכי תוקף"
            : "Track professional certification with validity dates",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה עובד" : "Staff member ID" },
              type: { 
                type: "string", 
                enum: ["license", "board_cert", "cme", "training"],
                description: isHebrew ? "סוג הסמכה" : "Certification type" 
              },
              name: { type: "string", description: isHebrew ? "שם ההסמכה" : "Certification name" },
              issuingOrganization: { type: "string", description: isHebrew ? "גוף מנפיק" : "Issuing organization" },
              issueDate: { type: "string", description: isHebrew ? "תאריך הנפקה" : "Issue date" },
              expirationDate: { type: "string", description: isHebrew ? "תאריך פקיעה" : "Expiration date" }
            },
            required: ["userId", "type", "name", "issuingOrganization", "issueDate", "expirationDate"]
          }
        },

{
          name: "checkExpiringCertifications",
          description: isHebrew
            ? "בדיקת תעודות הסמכה שפוקעות ב-30 הימים הקרובים"
            : "Check certifications expiring in the next 30 days",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        },

{
          name: "createPolicy",
          description: isHebrew
            ? "יצירת מדיניות חדשה עם תהליך אישור ותגי נושא"
            : "Create new policy with approval workflow and subject tags",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: isHebrew ? "כותרת המדיניות" : "Policy title" },
              description: { type: "string", description: isHebrew ? "תיאור המדיניות" : "Policy description" },
              category: { 
                type: "string", 
                enum: ["clinical", "administrative", "safety", "compliance"],
                description: isHebrew ? "קטגוריה" : "Category" 
              },
              type: { 
                type: "string", 
                enum: ["policy", "procedure", "guideline", "protocol"],
                description: isHebrew ? "סוג המדיניות" : "Policy type" 
              },
              content: { type: "string", description: isHebrew ? "תוכן המדיניות" : "Policy content" },
              effectiveDate: { type: "string", description: isHebrew ? "תאריך כניסה לתוקף" : "Effective date" },
              reviewDate: { type: "string", description: isHebrew ? "תאריך סקירה" : "Review date" },
              tags: { 
                type: "array", 
                items: { type: "string" },
                description: isHebrew ? "תגי נושא" : "Subject tags" 
              }
            },
            required: ["title", "category", "type", "content"]
          }
        },

{
          name: "updatePolicy",
          description: isHebrew
            ? "עדכון מדיניות קיימת עם ניהול גרסאות"
            : "Update existing policy with version management",
          parameters: {
            type: "object",
            properties: {
              policyId: { type: "string", description: isHebrew ? "מזהה מדיניות" : "Policy ID" },
              title: { type: "string", description: isHebrew ? "כותרת מעודכנת" : "Updated title" },
              content: { type: "string", description: isHebrew ? "תוכן מעודכן" : "Updated content" },
              changeReason: { type: "string", description: isHebrew ? "סיבת השינוי" : "Change reason" },
              effectiveDate: { type: "string", description: isHebrew ? "תאריך תוקף חדש" : "New effective date" }
            },
            required: ["policyId", "changeReason"]
          }
        },

{
          name: "approvePolicy",
          description: isHebrew
            ? "אישור מדיניות עם הערות ותנאים"
            : "Approve policy with comments and conditions",
          parameters: {
            type: "object",
            properties: {
              policyId: { type: "string", description: isHebrew ? "מזהה מדיניות" : "Policy ID" },
              decision: { 
                type: "string", 
                enum: ["approved", "rejected", "conditional"],
                description: isHebrew ? "החלטת אישור" : "Approval decision" 
              },
              approverName: { type: "string", description: isHebrew ? "שם מאשר" : "Approver name" },
              approverRole: { type: "string", description: isHebrew ? "תפקיד מאשר" : "Approver role" },
              comments: { type: "string", description: isHebrew ? "הערות" : "Comments" },
              conditions: { 
                type: "array", 
                items: { type: "string" },
                description: isHebrew ? "תנאי אישור" : "Approval conditions" 
              }
            },
            required: ["policyId", "decision", "approverName", "approverRole"]
          }
        },

{
          name: "publishPolicy",
          description: isHebrew
            ? "פרסום מדיניות לכל הצוות עם הפצה אוטומטית"
            : "Publish policy to all staff with automatic distribution",
          parameters: {
            type: "object",
            properties: {
              policyId: { type: "string", description: isHebrew ? "מזהה מדיניות" : "Policy ID" }
            },
            required: ["policyId"]
          }
        },

{
          name: "acknowledgePolicyDistribution",
          description: isHebrew
            ? "אישור קריאה והבנה של מדיניות על ידי עובד"
            : "Acknowledge policy reading and understanding by staff member",
          parameters: {
            type: "object",
            properties: {
              distributionId: { type: "string", description: isHebrew ? "מזהה הפצה" : "Distribution ID" },
              method: { 
                type: "string", 
                enum: ["electronic", "written", "verbal"],
                description: isHebrew ? "שיטת אישור" : "Acknowledgment method" 
              },
              understood: { type: "boolean", description: isHebrew ? "הבנה מלאה" : "Full understanding" },
              comments: { type: "string", description: isHebrew ? "הערות" : "Comments" }
            },
            required: ["distributionId"]
          }
        },

{
          name: "getPolicyComplianceReport",
          description: isHebrew
            ? "דוח ציות למדיניות עם סטטיסטיקות אישור ומעקב"
            : "Policy compliance report with acknowledgment statistics and tracking",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: isHebrew ? "תאריך התחלה" : "Start date" },
              endDate: { type: "string", description: isHebrew ? "תאריך סיום" : "End date" },
              policyIds: { 
                type: "array", 
                items: { type: "string" },
                description: isHebrew ? "מדיניות ספציפיות" : "Specific policies" 
              }
            },
            required: []
          }
        },

{
          name: "schedulePolicyReview",
          description: isHebrew
            ? "תזמון סקירת מדיניות עם מבקרים מוקצים"
            : "Schedule policy review with assigned reviewers",
          parameters: {
            type: "object",
            properties: {
              policyId: { type: "string", description: isHebrew ? "מזהה מדיניות" : "Policy ID" },
              scheduledDate: { type: "string", description: isHebrew ? "תאריך מתוכנן" : "Scheduled date" },
              assignedReviewers: { 
                type: "array", 
                items: { type: "string" },
                description: isHebrew ? "מבקרים מוקצים" : "Assigned reviewers" 
              },
              priority: { 
                type: "string", 
                enum: ["low", "medium", "high"],
                description: isHebrew ? "עדיפות" : "Priority" 
              }
            },
            required: ["policyId", "scheduledDate"]
          }
        },

{
          name: "generateCreditTranscript",
          description: isHebrew
            ? "יצירת גיליון נקודות זכות לשנת דיווח"
            : "Generate credit transcript for reporting year",
          parameters: {
            type: "object",
            properties: {
              userId: { type: "string", description: isHebrew ? "מזהה עובד" : "Staff member ID" },
              reportingYear: { type: "number", description: isHebrew ? "שנת דיווח" : "Reporting year" }
            },
            required: ["userId"]
          }
        }
    ];

    // Cache the results
    this.FUNCTION_CACHE.all[cacheKey] = complianceFunctions;
    this.FUNCTION_CACHE.initialized = true;

    console.log(`✅ ComplianceHelpers initialized with ${complianceFunctions.length} functions`);

    return complianceFunctions;
  }

  /**
   * Get compliance function names only (for function selection)
   */
  getComplianceFunctionNames() {
    const functions = this.getAllComplianceFunctions();
    return functions.map(f => f.name);
  }
}

// Create singleton instance
const complianceHelpers = new ComplianceHelpers();

// Export singleton
module.exports = complianceHelpers;
