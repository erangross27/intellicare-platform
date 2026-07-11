// IntelliCare Agent Service V4 - Main Platform AI Service
// Migrated to DDD NX architecture - AI Analytics Context - Claude Feature
// This is a modular wrapper that orchestrates all agent functionality

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AgentServiceV4 {
  constructor() {
    this.serviceId = 'agent-service-v4';
    this.serviceToken = null;
    this.initialized = false;
    this.modules = {};
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Load all modular components
      this.modules.additions = require('./agentServiceV4-additions');
      this.modules.guided = require('./agentServiceV4-guided');
      this.modules.phase1 = require('./agentServiceV4-phase1-additions');
      
      // Initialize modules
      await this.modules.additions.initialize();
      await this.modules.guided.initialize();
      await this.modules.phase1.initialize();
      
      this.initialized = true;
      console.log('✅ AgentServiceV4 initialized with all modules');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize AgentServiceV4:', error);
      throw error;
    }
  }

  // ========== CORE FUNCTION ORCHESTRATION ==========
  
  async processRequest(functionName, params, practiceContext, session) {
    if (!this.initialized) await this.initialize();

    try {
      // Route to appropriate module based on function name
      let targetModule = null;
      
      // Check additions module
      if (this.modules.additions[functionName]) {
        targetModule = this.modules.additions;
      }
      // Check phase1 module  
      else if (this.modules.phase1[functionName]) {
        targetModule = this.modules.phase1;
      }
      // Default core functions (implement as needed)
      else {
        return await this.handleCoreFunction(functionName, params, practiceContext, session);
      }
      
      // Execute function on target module
      const result = await targetModule[functionName](params, practiceContext, session);
      
      // Enhance response with guided features
      if (this.modules.guided) {
        return await this.modules.guided.enhanceAgentResponse(
          result, 
          params.message || '', 
          session.userId, 
          { lastFunction: functionName, ...params }
        );
      }
      
      return result;
    } catch (error) {
      console.error(`Error processing ${functionName}:`, error);
      return {
        success: false,
        error: session?.language === 'he' 
          ? 'שגיאה בעיבוד הבקשה' 
          : 'Error processing request'
      };
    }
  }

  // ========== CORE FUNCTIONS (Essential platform functions) ==========
  
  async handleCoreFunction(functionName, params, practiceContext, session) {
    const context = {
      serviceId: this.serviceId,
      operation: functionName,
      practiceId: practiceContext?.practiceId || session?.practiceId
    };

    switch (functionName) {
      case 'searchPatients':
        return await this.searchPatients(params, context, session);
      case 'getPatientDetails': 
        return await this.getPatientDetails(params, context, session);
      case 'addPatient':
        return await this.addPatient(params, context, session);
      case 'getTodaySchedule':
        return await this.getTodaySchedule(params, context, session);
      case 'getQuickStats':
        return await this.getQuickStats(params, context, session);
      default:
        return {
          success: false,
          error: session?.language === 'he' 
            ? `פונקציה לא נמצאה: ${functionName}` 
            : `Function not found: ${functionName}`
        };
    }
  }

  async searchPatients(params, context, session) {
    try {
      const { searchTerm, limit = 20 } = params;
      const isHebrew = session?.language === 'he';

      if (!searchTerm) {
        return {
          success: false,
          message: isHebrew ? 'חסר מונח חיפוש' : 'Search term required'
        };
      }

      const filter = {
        $or: [
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const patients = await secureDataAccess.query('patients', filter, { limit }, context);

      return {
        success: true,
        patients,
        message: isHebrew 
          ? `נמצאו ${patients.length} מטופלים` 
          : `Found ${patients.length} patients`
      };
    } catch (error) {
      console.error('Error searching patients:', error);
      return {
        success: false,
        error: session?.language === 'he' ? 'שגיאה בחיפוש מטופלים' : 'Error searching patients'
      };
    }
  }

  async getPatientDetails(params, context, session) {
    try {
      const { patientId } = params;
      const isHebrew = session?.language === 'he';

      if (!patientId) {
        return {
          success: false,
          message: isHebrew ? 'מזהה מטופל נדרש' : 'Patient ID required'
        };
      }

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const patients = await secureDataAccess.query('patients', { _id: patientId }, { limit: 1 }, context);
      const patient = patients[0];

      if (!patient) {
        return {
          success: false,
          message: isHebrew ? 'מטופל לא נמצא' : 'Patient not found'
        };
      }

      return {
        success: true,
        patient,
        message: isHebrew ? 'פרטי המטופל נטענו' : 'Patient details loaded'
      };
    } catch (error) {
      console.error('Error getting patient details:', error);
      return {
        success: false,
        error: session?.language === 'he' ? 'שגיאה בטעינת פרטי מטופל' : 'Error loading patient details'
      };
    }
  }

  async addPatient(params, context, session) {
    try {
      const { firstName, lastName, email, phone, dateOfBirth, gender } = params;
      const isHebrew = session?.language === 'he';

      if (!firstName || !lastName) {
        return {
          success: false,
          message: isHebrew ? 'שם פרטי ושם משפחה נדרשים' : 'First name and last name required'
        };
      }

      const patientData = {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        createdAt: new Date(),
        createdBy: session?.userId || 'system',
        practiceId: context.practiceId,
        status: 'active'
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const result = await secureDataAccess.create('patients', patientData, context);

      return {
        success: true,
        patient: result,
        message: isHebrew 
          ? `מטופל ${firstName} ${lastName} נוסף בהצלחה` 
          : `Patient ${firstName} ${lastName} added successfully`
      };
    } catch (error) {
      console.error('Error adding patient:', error);
      return {
        success: false,
        error: session?.language === 'he' ? 'שגיאה בהוספת מטופל' : 'Error adding patient'
      };
    }
  }

  async getTodaySchedule(params, context, session) {
    try {
      const isHebrew = session?.language === 'he';
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const filter = {
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        status: { $ne: 'cancelled' }
      };

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      const appointments = await secureDataAccess.query('appointments', filter, { 
        sort: { time: 1 },
        limit: 50 
      }, context);

      return {
        success: true,
        appointments,
        message: isHebrew 
          ? `לוח זמנים להיום: ${appointments.length} תורים` 
          : `Today's schedule: ${appointments.length} appointments`
      };
    } catch (error) {
      console.error('Error getting today schedule:', error);
      return {
        success: false,
        error: session?.language === 'he' ? 'שגיאה בטעינת לוח הזמנים' : 'Error loading schedule'
      };
    }
  }

  async getQuickStats(params, context, session) {
    try {
      const isHebrew = session?.language === 'he';
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));

      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');

      // Get today's appointments
      const todayAppointments = await secureDataAccess.query('appointments', {
        date: { $gte: startOfDay },
        status: { $ne: 'cancelled' }
      }, {}, context);

      // Get total patients
      const totalPatients = await secureDataAccess.query('patients', { status: 'active' }, {}, context);

      // Get pending tasks (simplified)
      const pendingTasks = await secureDataAccess.query('tasks', { 
        status: 'pending',
        assignedTo: session?.userId 
      }, {}, context);

      const stats = {
        todayAppointments: todayAppointments.length,
        totalPatients: totalPatients.length,
        pendingTasks: pendingTasks.length,
        lastUpdated: new Date()
      };

      return {
        success: true,
        stats,
        message: isHebrew ? 'סטטיסטיקות מהירות' : 'Quick statistics'
      };
    } catch (error) {
      console.error('Error getting quick stats:', error);
      return {
        success: false,
        error: session?.language === 'he' ? 'שגיאה בטעינת סטטיסטיקות' : 'Error loading statistics'
      };
    }
  }

  // ========== FUNCTION DISCOVERY ==========
  
  getAllFunctions() {
    const functions = [];
    
    // Add core functions
    functions.push('searchPatients', 'getPatientDetails', 'addPatient', 'getTodaySchedule', 'getQuickStats');
    
    // Add module functions
    if (this.modules.additions) {
      functions.push(...Object.keys(this.modules.additions).filter(key => typeof this.modules.additions[key] === 'function'));
    }
    
    if (this.modules.phase1) {
      functions.push(...Object.keys(this.modules.phase1).filter(key => typeof this.modules.phase1[key] === 'function'));
    }
    
    return functions.filter(fn => !fn.startsWith('_') && fn !== 'initialize' && fn !== 'constructor');
  }

  // ========== WELCOME MESSAGE ==========
  
  async getWelcomeMessage(userId, language = 'en') {
    if (!this.initialized) await this.initialize();
    
    if (this.modules.guided) {
      return await this.modules.guided.getWelcomeMessage(userId, language);
    }
    
    const isHebrew = language === 'he';
    return isHebrew 
      ? '👋 ברוך הבא ל-IntelliCare! איך אוכל לעזור לך היום?'
      : '👋 Welcome to IntelliCare! How can I help you today?';
  }
}

// Create and export singleton
const agentServiceV4 = new AgentServiceV4();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('agentServiceV4', () => agentServiceV4);
}

module.exports = agentServiceV4;