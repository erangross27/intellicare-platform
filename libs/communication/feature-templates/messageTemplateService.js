// Use lazy loading to resolve circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/communication/feature-templates/:
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Message Template Service
 * Manages communication message templates for SMS, email, and patient portal messages.
 * Provides template creation, customization, personalization, and version control.
 * 
 * Features:
 * - Pre-built templates for common communications
 * - Custom template creation and editing
 * - Variable substitution and personalization
 * - Multi-language support (Hebrew/English)
 * - Template versioning and approval workflow
 * - Usage analytics and performance tracking
 */
class MessageTemplateService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.serviceId = 'message-template-service';
    
    // Pre-built templates
    this.defaultTemplates = {
      // Appointment reminders
      appointment_reminder_24h: {
        name: 'Appointment Reminder - 24 Hours',
        type: 'appointment_reminder',
        channels: ['sms', 'email'],
        templates: {
          en: {
            sms: 'Reminder: You have an appointment with {providerName} tomorrow at {appointmentTime}. Reply CONFIRM to confirm or CANCEL to cancel.',
            email: {
              subject: 'Appointment Reminder - {appointmentDate}',
              body: `Dear {firstName},

This is a reminder that you have an appointment scheduled:

Date: {appointmentDate}
Time: {appointmentTime}  
Provider: {providerName}
Location: {clinicAddress}

Please confirm your attendance by replying to this email or calling {clinicPhone}.

If you need to reschedule, please contact us at least 24 hours in advance.

Thank you,
{practiceName}`
            }
          },
          he: {
            sms: 'תזכורת: יש לך תור אצל {providerName} מחר בשעה {appointmentTime}. השב אישור לאישור או ביטול לביטול.',
            email: {
              subject: 'תזכורת לתור - {appointmentDate}',
              body: `שלום {firstName},

זו תזכורת שיש לך תור מתוכנן:

תאריך: {appointmentDate}
שעה: {appointmentTime}
רופא: {providerName}
כתובת: {clinicAddress}

אנא אשר את הגעתך על ידי מענה למייל זה או התקשרות למספר {clinicPhone}.

אם אתה צריך לדחות את התור, אנא צור קשר לפחות 24 שעות מראש.

תודה,
{practiceName}`
            }
          }
        }
      },
      
      // Test results
      test_results_ready: {
        name: 'Test Results Available',
        type: 'test_results',
        channels: ['sms', 'email', 'portal'],
        templates: {
          en: {
            sms: 'Your lab results are ready. Please log into the patient portal or call {clinicPhone} to discuss with your provider.',
            email: {
              subject: 'Your Test Results Are Ready',
              body: `Dear {firstName},

Your recent test results are now available.

Please log into your patient portal to view the results, or contact us at {clinicPhone} to discuss them with your healthcare provider.

Test Date: {testDate}
Test Type: {testType}

For your privacy and security, detailed results are only available through the secure patient portal or by speaking directly with your provider.

Best regards,
{practiceName}`
            }
          },
          he: {
            sms: 'תוצאות הבדיקות שלך מוכנות. אנא היכנס לפורטל המטופלים או התקשר ל{clinicPhone} כדי לדון עם הרופא.',
            email: {
              subject: 'תוצאות הבדיקות שלך מוכנות',
              body: `שלום {firstName},

תוצאות הבדיקות האחרונות שלך כעת זמינות.

אנא היכנס לפורטל המטופלים כדי לצפות בתוצאות, או צור קשר איתנו במספר {clinicPhone} כדי לדון עליהן עם הרופא.

תאריך בדיקה: {testDate}
סוג בדיקה: {testType}

לשמירת הפרטיות והאבטחה שלך, תוצאות מפורטות זמינות רק דרך הפורטל המאובטח או בדיבור ישירות עם הרופא.

בברכה,
{practiceName}`
            }
          }
        }
      },
      
      // Prescription refills
      prescription_refill_reminder: {
        name: 'Prescription Refill Reminder',
        type: 'prescription_refill',
        channels: ['sms', 'email'],
        templates: {
          en: {
            sms: 'Your prescription for {medicationName} expires in {daysLeft} days. Contact us to renew: {clinicPhone}',
            email: {
              subject: 'Prescription Renewal Needed - {medicationName}',
              body: `Dear {firstName},

This is a reminder that your prescription for {medicationName} will expire soon:

Medication: {medicationName}
Current Prescription Expires: {expirationDate}
Days Remaining: {daysLeft}

To avoid any interruption in your treatment, please contact us to renew your prescription:
- Call us at {clinicPhone}
- Use the patient portal to request a refill
- Schedule an appointment if a consultation is needed

Please note that some medications may require a new consultation before renewal.

Thank you,
{practiceName}`
            }
          },
          he: {
            sms: 'המרשם שלך ל{medicationName} יפוג בעוד {daysLeft} ימים. צור קשר לחידוש: {clinicPhone}',
            email: {
              subject: 'נדרש חידוש מרשם - {medicationName}',
              body: `שלום {firstName},

זו תזכורת שהמרשם שלך ל{medicationName} יפוג בקרוב:

תרופה: {medicationName}
תפוגת המרשם הנוכחי: {expirationDate}
ימים נותרים: {daysLeft}

כדי להמנע מהפרעה בטיפול שלך, אנא צור קשר לחידוש המרשם:
- התקשר אלינו למספר {clinicPhone}
- השתמש בפורטל המטופלים לבקשת חידוש
- קבע תור אם נדרשת היוועצות

שים לב שתרופות מסוימות עשויות לדרוש היוועצות חדשה לפני החידוש.

תודה,
{practiceName}`
            }
          }
        }
      },
      
      // Health screening invitations
      health_screening_invitation: {
        name: 'Health Screening Invitation',
        type: 'health_screening',
        channels: ['email', 'sms'],
        templates: {
          en: {
            sms: 'Important: You\'re due for a {screeningType} screening. Call {clinicPhone} to schedule.',
            email: {
              subject: 'Important Health Screening - {screeningType}',
              body: `Dear {firstName},

Based on your age and health history, you are now due for an important health screening:

Recommended Screening: {screeningType}
Recommended Frequency: {frequency}
Last Screening: {lastScreeningDate}

Early detection saves lives. This screening can help detect potential health issues before they become serious problems.

To schedule your {screeningType}:
- Call us at {clinicPhone}
- Use the online patient portal
- Reply to this email

Most insurance plans cover preventive screenings at 100%.

Don't wait - your health is worth it!

{practiceName}`
            }
          },
          he: {
            sms: 'חשוב: אתה זקוק לבדיקת {screeningType}. התקשר ל{clinicPhone} לתיאום.',
            email: {
              subject: 'בדיקה רפואית חשובה - {screeningType}',
              body: `שלום {firstName},

על בסיס הגיל וההיסטוריה הרפואית שלך, אתה זקוק לבדיקה רפואית חשובה:

בדיקה מומלצת: {screeningType}
תדירות מומלצת: {frequency}
בדיקה אחרונה: {lastScreeningDate}

גילוי מוקדם מציל חיים. בדיקה זו יכולה לעזור לגלות בעיות בריאותיות פוטנציאליות לפני שהן הופכות לבעיות חמורות.

לתיאום בדיקת {screeningType}:
- התקשר אלינו למספר {clinicPhone}
- השתמש בפורטל המטופלים המקוון
- השב למייל זה

רוב תוכניות הביטוח מכסות בדיקות מניעה ב-100%.

אל תחכה - הבריאות שלך שווה את זה!

{practiceName}`
            }
          }
        }
      }
    };
    
    // Template variables
    this.availableVariables = {
      patient: ['firstName', 'lastName', 'fullName', 'age', 'dateOfBirth', 'phone', 'email'],
      appointment: ['appointmentDate', 'appointmentTime', 'providerName', 'appointmentType', 'duration'],
      practice: ['practiceName', 'clinicPhone', 'clinicAddress', 'clinicEmail'],
      medication: ['medicationName', 'dosage', 'frequency', 'expirationDate', 'daysLeft'],
      test: ['testType', 'testDate', 'testResults', 'normalRange'],
      screening: ['screeningType', 'frequency', 'lastScreeningDate', 'dueDate']
    };
  }
  
  // Helper method for lazy service access
  getServices() {
    const proxy = getServiceProxy();
    return {
      secureDataAccess: proxy.getService('secureDataAccess'),
      serviceAccountManager: proxy.getService('serviceAccountManager'),
      auditLog: proxy.getService('auditLog')
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const { serviceAccountManager } = this.getServices();
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize default templates in database
      await this.initializeDefaultTemplates();
      
      this.initialized = true;
      console.log('✅ Message Template Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Message Template Service:', error);
      throw error;
    }
  }

  /**
   * Get available message templates
   */
  async getMessageTemplates(params, practiceContext) {
    try {
      const { type, channel, language, active = true } = params;
      
      // Build query
      let query = { practiceId: practiceContext.practiceId };
      
      if (type) {
        query.type = type;
      }
      
      if (channel) {
        query.channels = { $in: [channel] };
      }
      
      if (active !== undefined) {
        query.active = active;
      }
      
      // Get templates from database
      const templates = await SecureDataAccess.query(
        'message_templates',
        query,
        { sort: { name: 1 } },
        {
          serviceId: this.serviceId,
          operation: 'get-message-templates',
          practiceId: practiceContext.practiceId
        }
      );
      
      // Filter by language if specified
      const filteredTemplates = templates.map(template => {
        if (language && template.templates[language]) {
          return {
            ...template,
            template: template.templates[language]
          };
        }
        return template;
      });
      
      return {
        success: true,
        templates: filteredTemplates,
        totalTemplates: filteredTemplates.length,
        availableTypes: [...new Set(templates.map(t => t.type))],
        availableChannels: [...new Set(templates.flatMap(t => t.channels))]
      };
      
    } catch (error) {
      console.error('❌ Failed to get message templates:', error);
      throw error;
    }
  }

  /**
   * Create new custom message template
   */
  async createMessageTemplate(params, practiceContext) {
    try {
      const { 
        name, 
        type, 
        channels, 
        templates, 
        description, 
        category = 'custom',
        variables = [],
        active = true 
      } = params;
      
      if (!name || !type || !channels || !templates) {
        throw new Error('Name, type, channels, and templates are required');
      }
      
      // Validate template structure
      this.validateTemplateStructure(templates);
      
      // Create template record
      const templateRecord = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
        name: name,
        type: type,
        category: category,
        channels: Array.isArray(channels) ? channels : [channels],
        templates: templates,
        description: description,
        variables: variables,
        active: active,
        createdAt: new Date(),
        updatedAt: new Date(),
        practiceId: practiceContext.practiceId,
        createdBy: practiceContext.userId || 'system',
        version: 1,
        usageCount: 0
      };
      
      // Save template
      const savedTemplate = await SecureDataAccess.create(
        'message_templates',
        templateRecord,
        {
          serviceId: this.serviceId,
          operation: 'create-message-template',
          practiceId: practiceContext.practiceId
        }
      );
      
      // Audit the creation
      await this.auditTemplateAction({
        action: 'TEMPLATE_CREATED',
        templateId: savedTemplate._id,
        templateName: name,
        templateType: type,
        practiceId: practiceContext.practiceId,
        userId: practiceContext.userId
      });
      
      return {
        success: true,
        templateId: savedTemplate._id,
        message: 'Message template created successfully',
        template: savedTemplate
      };
      
    } catch (error) {
      console.error('❌ Failed to create message template:', error);
      throw error;
    }
  }

  /**
   * Render template with variables
   */
  async renderTemplate(params, practiceContext) {
    try {
      const { templateId, templateType, channel, language = 'en', variables = {} } = params;
      
      // Get template
      let template;
      if (templateId) {
        const templates = await SecureDataAccess.query(
          'message_templates',
          { _id: templateId, active: true },
          {},
          {
            serviceId: this.serviceId,
            operation: 'render-template',
            practiceId: practiceContext.practiceId
          }
        );
        template = templates?.[0] || null;
      } else if (templateType) {
        const templates = await SecureDataAccess.query(
          'message_templates',
          { type: templateType, active: true, channels: { $in: [channel] } },
          {},
          {
            serviceId: this.serviceId,
            operation: 'render-template',
            practiceId: practiceContext.practiceId
          }
        );
        template = templates?.[0] || null;
      }
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Get template content for specified language and channel
      const templateContent = template.templates[language]?.[channel];
      if (!templateContent) {
        throw new Error(`Template not available for language ${language} and channel ${channel}`);
      }
      
      // Render template
      const rendered = this.substituteVariables(templateContent, variables);
      
      // Update usage count
      await this.updateTemplateUsage(template._id, practiceContext);
      
      return {
        success: true,
        rendered: rendered,
        templateId: template._id,
        templateName: template.name,
        channel: channel,
        language: language
      };
      
    } catch (error) {
      console.error('❌ Failed to render template:', error);
      throw error;
    }
  }

  /**
   * Get template usage analytics
   */
  async getTemplateAnalytics(params, practiceContext) {
    try {
      const { templateId, startDate, endDate, groupBy = 'template' } = params;
      
      // Build query for template usage
      let query = { practiceId: practiceContext.practiceId };
      
      if (templateId) {
        query.templateId = templateId;
      }
      
      if (startDate || endDate) {
        query.usedAt = {};
        if (startDate) query.usedAt.$gte = new Date(startDate);
        if (endDate) query.usedAt.$lte = new Date(endDate);
      }
      
      // Get usage records
      const usageRecords = await SecureDataAccess.query(
        'template_usage',
        query,
        { sort: { usedAt: -1 } },
        {
          serviceId: this.serviceId,
          operation: 'get-template-analytics',
          practiceId: practiceContext.practiceId
        }
      );
      
      // Get templates for additional info
      const templates = await SecureDataAccess.query(
        'message_templates',
        { practiceId: practiceContext.practiceId },
        {},
        {
          serviceId: this.serviceId,
          operation: 'get-template-analytics',
          practiceId: practiceContext.practiceId
        }
      );
      
      // Generate analytics
      const analytics = this.generateTemplateAnalytics(usageRecords, templates, groupBy);
      
      return {
        success: true,
        analytics: analytics,
        totalUsage: usageRecords.length,
        period: { startDate, endDate },
        groupBy: groupBy
      };
      
    } catch (error) {
      console.error('❌ Failed to get template analytics:', error);
      throw error;
    }
  }

  // Helper Methods

  async initializeDefaultTemplates() {
    try {
      // Check if default templates already exist
      const existingDefaults = await SecureDataAccess.query(
        'message_templates',
        { category: 'default' },
        { limit: 1 },
        {
          serviceId: this.serviceId,
          operation: 'initialize-default-templates',
          practiceId: 'global'
        }
      );
      
      if (existingDefaults.length > 0) {
        console.log('Default templates already initialized');
        return;
      }
      
      // Create default templates
      for (const [key, templateData] of Object.entries(this.defaultTemplates)) {
        const templateRecord = {
          _id: key,
          ...templateData,
          category: 'default',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          practiceId: 'global',
          createdBy: 'system',
          version: 1,
          usageCount: 0
        };
        
        await SecureDataAccess.create(
          'message_templates',
          templateRecord,
          {
            serviceId: this.serviceId,
            operation: 'initialize-default-templates',
            practiceId: 'global'
          }
        );
      }
      
      console.log('✅ Default message templates initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize default templates:', error);
    }
  }

  validateTemplateStructure(templates) {
    const requiredLanguages = ['en'];
    const requiredChannels = ['sms', 'email'];
    
    for (const lang of requiredLanguages) {
      if (!templates[lang]) {
        throw new Error(`Template must include ${lang} language`);
      }
    }
    
    // Validate email templates have subject and body
    for (const [lang, langTemplates] of Object.entries(templates)) {
      if (langTemplates.email) {
        if (!langTemplates.email.subject || !langTemplates.email.body) {
          throw new Error(`Email template for ${lang} must have subject and body`);
        }
      }
    }
  }

  substituteVariables(template, variables) {
    if (typeof template === 'string') {
      // Simple string template
      let rendered = template;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = new RegExp(`\\{${key}\\}`, 'g');
        rendered = rendered.replace(placeholder, value || '');
      }
      return rendered;
    } else if (typeof template === 'object') {
      // Email template with subject and body
      return {
        subject: this.substituteVariables(template.subject, variables),
        body: this.substituteVariables(template.body, variables)
      };
    }
    
    return template;
  }

  async updateTemplateUsage(templateId, practiceContext) {
    try {
      // Update usage count in template
      await SecureDataAccess.update(
        'message_templates',
        { _id: templateId },
        { 
          $inc: { usageCount: 1 },
          lastUsedAt: new Date()
        },
        {
          serviceId: this.serviceId,
          operation: 'update-template-usage',
          practiceId: practiceContext.practiceId
        }
      );
      
      // Record usage for analytics
      const usageRecord = {
        _id: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
        templateId: templateId,
        practiceId: practiceContext.practiceId,
        usedBy: practiceContext.userId || 'system',
        usedAt: new Date()
      };
      
      await SecureDataAccess.create(
        'template_usage',
        usageRecord,
        {
          serviceId: this.serviceId,
          operation: 'update-template-usage',
          practiceId: practiceContext.practiceId
        }
      );
      
    } catch (error) {
      console.error('❌ Failed to update template usage:', error);
    }
  }

  generateTemplateAnalytics(usageRecords, templates, groupBy) {
    const templateMap = new Map(templates.map(t => [t._id, t]));
    
    const analytics = {
      mostUsedTemplates: [],
      usageByType: {},
      usageByChannel: {},
      usageOverTime: {}
    };
    
    // Count usage by template
    const templateUsage = {};
    usageRecords.forEach(record => {
      const template = templateMap.get(record.templateId);
      if (template) {
        templateUsage[record.templateId] = (templateUsage[record.templateId] || 0) + 1;
        
        // Usage by type
        analytics.usageByType[template.type] = (analytics.usageByType[template.type] || 0) + 1;
        
        // Usage by channel
        template.channels.forEach(channel => {
          analytics.usageByChannel[channel] = (analytics.usageByChannel[channel] || 0) + 1;
        });
      }
    });
    
    // Most used templates
    analytics.mostUsedTemplates = Object.entries(templateUsage)
      .map(([templateId, count]) => ({
        templateId,
        templateName: templateMap.get(templateId)?.name,
        usageCount: count
      }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);
    
    return analytics;
  }

  async auditTemplateAction(auditData) {
    try {
      await AuditLog.create({
        action: auditData.action,
        category: 'message_template',
        userId: auditData.userId || 'system',
        practiceId: auditData.practiceId,
        metadata: {
          templateId: auditData.templateId,
          templateName: auditData.templateName,
          templateType: auditData.templateType
        },
        timestamp: new Date()
      });
    } catch (error) {
      console.error('❌ Failed to audit template action:', error);
    }
  }
}

// Create singleton instance
const messageTemplateService = new MessageTemplateService();

// Register service with ServiceProxyManager for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('messageTemplateService', () => messageTemplateService);
}

// Export singleton instance
module.exports = messageTemplateService;