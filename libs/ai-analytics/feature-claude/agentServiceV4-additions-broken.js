// Additional function implementations for agentServiceV4.js
// These functions complete the partially implemented categories
// Migrated to DDD NX architecture - AI Analytics Context - Claude Feature

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AgentServiceV4Additions {
  constructor() {
    this.serviceId = 'agent-service-v4-additions';
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      this.initialized = true;
      console.log('✅ AgentServiceV4Additions initialized with authentication');
    } catch (error) {
      console.error('❌ Failed to initialize AgentServiceV4Additions:', error);
      throw error;
    }
  }

  async callAPI(endpoint, method, data, practiceContext) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const context = {
        serviceId: this.serviceId,
        operation: `api-call-${method.toLowerCase()}-${endpoint}`,
        practiceId: practiceContext?.practiceId || 'global'
      };
      
      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      const result = await SecureDataAccess.query('api_calls', {
        endpoint,
        method,
        data,
        practiceContext
      }, {}, context);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`API call failed: ${method} ${endpoint}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ========== DIAGNOSIS & TREATMENT (Missing 2) ==========

  // Get differential diagnosis based on symptoms
  async getDifferentialDiagnosis(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.symptoms) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרשים תסמינים לצורך אבחנה מבדלת' 
          : 'Symptoms are required for differential diagnosis'
      };
    }
    
    // Prepare diagnosis request
    const diagnosisData = {
      symptoms: Array.isArray(params.symptoms) ? params.symptoms : params.symptoms.split(',').map(s => s.trim()),
      patientId: params.patientId || session.currentContext?.patientId,
      urgency: params.urgency || 'routine'
    };
    
    // Call diagnosis API
    const result = await this.callAPI('/diagnosis/differential', 'POST', diagnosisData, practiceContext);
    
    if (result.success && result.data) {
      return {
        success: true,
        message: isHebrew
          ? `נמצאו ${result.data.length} אבחנות אפשריות`
          : `Found ${result.data.length} possible diagnoses`,
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in getDifferentialDiagnosis:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בקבלת אבחנה מבדלת' 
        : 'Error getting differential diagnosis',
      error: error.message
    };
  }
},

// Recommend medical tests based on symptoms/diagnosis
recommendTests: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.symptoms && !params.diagnosis) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרשים תסמינים או אבחנה לצורך המלצת בדיקות' 
          : 'Symptoms or diagnosis required to recommend tests'
      };
    }
    
    // Prepare test recommendation request
    const testData = {
      symptoms: params.symptoms,
      diagnosis: params.diagnosis,
      patientId: params.patientId || session.currentContext?.patientId,
      urgency: params.urgency || 'routine'
    };
    
    // Call test recommendation API
    const result = await this.callAPI('/diagnosis/recommend-tests', 'POST', testData, practiceContext);
    
    if (result.success && result.data) {
      return {
        success: true,
        message: isHebrew
          ? `מומלצות ${result.data.length} בדיקות`
          : `${result.data.length} tests recommended`,
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in recommendTests:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בהמלצת בדיקות' 
        : 'Error recommending tests',
      error: error.message
    };
  }
},

// ========== APPOINTMENTS (Missing 3) ==========

// Get patient appointments
getAppointments: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Get patient ID from params or context
    const patientId = params.patientId || session.currentContext?.patientId;
    
    if (!patientId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה מטופל לצורך קבלת תורים' 
          : 'Patient ID required to get appointments'
      };
    }
    
    // Call appointments API
    const result = await this.callAPI(`/appointments/patient/${patientId}`, 'GET', params, practiceContext);
    
    if (result.success && result.data) {
      const appointments = Array.isArray(result.data) ? result.data : [];
      return {
        success: true,
        message: isHebrew
          ? `נמצאו ${appointments.length} תורים`
          : `Found ${appointments.length} appointments`,
        data: appointments
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in getAppointments:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בקבלת תורים' 
        : 'Error getting appointments',
      error: error.message
    };
  }
},

// Reschedule an appointment
rescheduleAppointment: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.appointmentId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה תור לצורך שינוי' 
          : 'Appointment ID required for rescheduling'
      };
    }
    
    if (!params.newDate) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש תאריך חדש לתור' 
          : 'New date required for rescheduling'
      };
    }
    
    // Prepare reschedule data
    const rescheduleData = {
      newDate: params.newDate,
      newTime: params.newTime,
      reason: params.reason
    };
    
    // Call reschedule API
    const result = await this.callAPI(
      `/appointments/${params.appointmentId}/reschedule`, 
      'PUT', 
      rescheduleData, 
      practiceContext
    );
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'התור נקבע מחדש בהצלחה'
          : 'Appointment rescheduled successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in rescheduleAppointment:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בשינוי התור' 
        : 'Error rescheduling appointment',
      error: error.message
    };
  }
},

// Cancel an appointment
cancelAppointment: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.appointmentId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה תור לצורך ביטול' 
          : 'Appointment ID required for cancellation'
      };
    }
    
    // Prepare cancellation data
    const cancelData = {
      status: 'cancelled',
      reason: params.reason || (isHebrew ? 'ביטול על ידי המטופל' : 'Cancelled by patient'),
      cancelledBy: params.cancelledBy || 'patient'
    };
    
    // Call cancel API
    const result = await this.callAPI(
      `/appointments/${params.appointmentId}/status`, 
      'PUT', 
      cancelData, 
      practiceContext
    );
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'התור בוטל בהצלחה'
          : 'Appointment cancelled successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in cancelAppointment:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בביטול התור' 
        : 'Error cancelling appointment',
      error: error.message
    };
  }
},

// ========== CHAT & CONSULTATION (Missing 2) ==========

// Get all chat sessions for a patient
getChatSessions: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Get patient ID from params or context
    const patientId = params.patientId || session.currentContext?.patientId;
    
    if (!patientId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה מטופל לצורך קבלת שיחות' 
          : 'Patient ID required to get chat sessions'
      };
    }
    
    // Call chat sessions API
    const result = await this.callAPI(`/chat/sessions/patient/${patientId}`, 'GET', params, practiceContext);
    
    if (result.success && result.data) {
      const sessions = Array.isArray(result.data) ? result.data : [];
      return {
        success: true,
        message: isHebrew
          ? `נמצאו ${sessions.length} שיחות`
          : `Found ${sessions.length} chat sessions`,
        data: sessions
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in getChatSessions:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בקבלת שיחות' 
        : 'Error getting chat sessions',
      error: error.message
    };
  }
},

// Get messages from a specific chat session
getChatMessages: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.sessionId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה שיחה לצורך קבלת הודעות' 
          : 'Session ID required to get messages'
      };
    }
    
    // Call chat messages API
    const result = await this.callAPI(`/chat/sessions/${params.sessionId}/messages`, 'GET', params, practiceContext);
    
    if (result.success && result.data) {
      const messages = Array.isArray(result.data) ? result.data : [];
      return {
        success: true,
        message: isHebrew
          ? `נמצאו ${messages.length} הודעות`
          : `Found ${messages.length} messages`,
        data: messages
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in getChatMessages:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בקבלת הודעות' 
        : 'Error getting messages',
      error: error.message
    };
  }
},

// ========== USER MANAGEMENT (Missing 5) ==========

// Update user information
updateUser: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.userId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה משתמש לצורך עדכון' 
          : 'User ID required for update'
      };
    }
    
    // Prepare update data
    const updateData = {
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone,
      role: params.role,
      department: params.department,
      specialization: params.specialization
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );
    
    // Call update user API
    const result = await this.callAPI(`/users/${params.userId}`, 'PUT', updateData, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'פרטי המשתמש עודכנו בהצלחה'
          : 'User updated successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in updateUser:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בעדכון משתמש' 
        : 'Error updating user',
      error: error.message
    };
  }
},

// Delete a user
deleteUser: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.userId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה משתמש לצורך מחיקה' 
          : 'User ID required for deletion'
      };
    }
    
    // Call delete user API
    const result = await this.callAPI(`/users/${params.userId}`, 'DELETE', { reason: params.reason }, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'המשתמש נמחק בהצלחה'
          : 'User deleted successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in deleteUser:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה במחיקת משתמש' 
        : 'Error deleting user',
      error: error.message
    };
  }
},

// Reset user password
resetPassword: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.userId && !params.email) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה משתמש או אימייל לאיפוס סיסמה' 
          : 'User ID or email required for password reset'
      };
    }
    
    // Prepare reset data
    const resetData = {
      userId: params.userId,
      email: params.email,
      temporaryPassword: params.temporaryPassword,
      requireChange: params.requireChange !== false // Default to true
    };
    
    // Call password reset API
    const result = await this.callAPI('/users/reset-password', 'POST', resetData, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'הסיסמה אופסה בהצלחה. נשלח אימייל למשתמש'
          : 'Password reset successfully. Email sent to user',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in resetPassword:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה באיפוס סיסמה' 
        : 'Error resetting password',
      error: error.message
    };
  }
},

// Update user permissions
updatePermissions: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.userId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה משתמש לצורך עדכון הרשאות' 
          : 'User ID required for updating permissions'
      };
    }
    
    if (!params.permissions) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרשות הרשאות לעדכון' 
          : 'Permissions required for update'
      };
    }
    
    // Call update permissions API
    const result = await this.callAPI(
      `/users/${params.userId}/permissions`, 
      'PUT', 
      { permissions: params.permissions }, 
      practiceContext
    );
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'ההרשאות עודכנו בהצלחה'
          : 'Permissions updated successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in updatePermissions:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בעדכון הרשאות' 
        : 'Error updating permissions',
      error: error.message
    };
  }
},

// Enable MFA for user
enableMFA: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.userId) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה משתמש להפעלת אימות דו-שלבי' 
          : 'User ID required to enable MFA'
      };
    }
    
    // Call enable MFA API
    const result = await this.callAPI(
      `/users/${params.userId}/mfa`, 
      'POST', 
      { enable: true, method: params.method || 'totp' }, 
      practiceContext
    );
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'אימות דו-שלבי הופעל בהצלחה'
          : 'MFA enabled successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in enableMFA:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בהפעלת אימות דו-שלבי' 
        : 'Error enabling MFA',
      error: error.message
    };
  }
},

// ========== PRACTICE MANAGEMENT (Missing 2) ==========

// Manage practice subscription
manageSubscription: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Prepare subscription data
    const subscriptionData = {
      action: params.action || 'view', // view, upgrade, downgrade, cancel
      plan: params.plan,
      billingCycle: params.billingCycle
    };
    
    // Call subscription API
    const result = await this.callAPI('/practice/subscription', 'POST', subscriptionData, practiceContext);
    
    if (result.success) {
      const actionMessage = {
        view: isHebrew ? 'פרטי המנוי' : 'Subscription details',
        upgrade: isHebrew ? 'המנוי שודרג בהצלחה' : 'Subscription upgraded successfully',
        downgrade: isHebrew ? 'המנוי שונה בהצלחה' : 'Subscription downgraded successfully',
        cancel: isHebrew ? 'המנוי בוטל' : 'Subscription cancelled'
      };
      
      return {
        success: true,
        message: actionMessage[params.action] || actionMessage.view,
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in manageSubscription:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בניהול המנוי' 
        : 'Error managing subscription',
      error: error.message
    };
  }
},

// Update language settings
updateLanguageSettings: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.language) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרשת שפה לעדכון' 
          : 'Language required for update'
      };
    }
    
    // Prepare language settings
    const languageData = {
      primaryLanguage: params.language,
      secondaryLanguage: params.secondaryLanguage,
      rtl: params.language === 'he' || params.language === 'ar'
    };
    
    // Call language settings API
    const result = await this.callAPI('/practice/settings/language', 'PUT', languageData, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'הגדרות השפה עודכנו בהצלחה'
          : 'Language settings updated successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in updateLanguageSettings:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בעדכון הגדרות שפה' 
        : 'Error updating language settings',
      error: error.message
    };
  }
},

// ========== REPORTS & ANALYTICS (Missing 3) ==========

// Get usage analytics
getUsageAnalytics: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Prepare analytics parameters
    const analyticsParams = {
      startDate: params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: params.endDate || new Date().toISOString(),
      metrics: params.metrics || ['appointments', 'patients', 'documents', 'chats']
    };
    
    // Call analytics API
    const result = await this.callAPI('/analytics/usage', 'GET', analyticsParams, practiceContext);
    
    if (result.success && result.data) {
      return {
        success: true,
        message: isHebrew
          ? 'נתוני השימוש נטענו בהצלחה'
          : 'Usage analytics loaded successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in getUsageAnalytics:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בטעינת נתוני שימוש' 
        : 'Error loading usage analytics',
      error: error.message
    };
  }
},

// Export analytics data
exportAnalytics: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Prepare export parameters
    const exportParams = {
      format: params.format || 'csv',
      startDate: params.startDate,
      endDate: params.endDate,
      includeCharts: params.includeCharts || false
    };
    
    // Call export API
    const result = await this.callAPI('/analytics/export', 'POST', exportParams, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? `הנתונים יוצאו בהצלחה לקובץ ${params.format || 'CSV'}`
          : `Analytics exported successfully to ${params.format || 'CSV'}`,
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in exportAnalytics:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בייצוא נתונים' 
        : 'Error exporting analytics',
      error: error.message
    };
  }
},

// Create custom report
createCustomReport: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.reportType) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש סוג דוח' 
          : 'Report type required'
      };
    }
    
    // Prepare report parameters
    const reportData = {
      type: params.reportType,
      filters: params.filters || {},
      groupBy: params.groupBy,
      sortBy: params.sortBy,
      format: params.format || 'pdf'
    };
    
    // Call custom report API
    const result = await this.callAPI('/reports/custom', 'POST', reportData, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'הדוח נוצר בהצלחה'
          : 'Report created successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in createCustomReport:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה ביצירת דוח' 
        : 'Error creating report',
      error: error.message
    };
  }
},

// ========== SYSTEM & SECURITY (Missing 3) ==========

// Get database statistics
getDatabaseStats: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Call database stats API
    const result = await this.callAPI('/system/database/stats', 'GET', params, practiceContext);
    
    if (result.success && result.data) {
      return {
        success: true,
        message: isHebrew
          ? 'סטטיסטיקות מסד הנתונים נטענו'
          : 'Database statistics loaded',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in getDatabaseStats:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בטעינת סטטיסטיקות' 
        : 'Error loading database stats',
      error: error.message
    };
  }
},

// Clear system cache
clearCache: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Prepare cache clear parameters
    const cacheParams = {
      type: params.type || 'all', // all, sessions, queries, images
      force: params.force || false
    };
    
    // Call clear cache API
    const result = await this.callAPI('/system/cache/clear', 'POST', cacheParams, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'המטמון נוקה בהצלחה'
          : 'Cache cleared successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in clearCache:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בניקוי מטמון' 
        : 'Error clearing cache',
      error: error.message
    };
  }
},

// Restore from backup
restoreBackup: async function(params, practiceContext, session) {
  try {
    const isHebrew = session.language === 'he';
    
    // Validate required parameters
    if (!params.backupId && !params.backupDate) {
      return {
        success: false,
        message: isHebrew 
          ? 'נדרש מזהה גיבוי או תאריך' 
          : 'Backup ID or date required'
      };
    }
    
    // Prepare restore parameters
    const restoreData = {
      backupId: params.backupId,
      backupDate: params.backupDate,
      targetDatabase: params.targetDatabase || 'current',
      skipValidation: params.skipValidation || false
    };
    
    // Call restore API
    const result = await this.callAPI('/system/backup/restore', 'POST', restoreData, practiceContext);
    
    if (result.success) {
      return {
        success: true,
        message: isHebrew
          ? 'השחזור מגיבוי הושלם בהצלחה'
          : 'Backup restored successfully',
        data: result.data
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in restoreBackup:', error);
    return {
      success: false,
      message: session.language === 'he' 
        ? 'שגיאה בשחזור מגיבוי' 
        : 'Error restoring backup',
      error: error.message
    };
  }
}

}

// Create instance
const agentServiceV4Additions = new AgentServiceV4Additions();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('agentServiceV4Additions', () => agentServiceV4Additions);
}

module.exports = agentServiceV4Additions;