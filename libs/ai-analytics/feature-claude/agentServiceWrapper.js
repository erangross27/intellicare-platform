// IntelliCare Agent Service Wrapper
// Migrated to DDD NX architecture - AI Analytics Context - Claude Feature
// This service provides a unified interface to all AI agent services

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class AgentServiceWrapper {
  constructor() {
    this.serviceId = 'agent-service-wrapper';
    this.serviceToken = null;
    this.initialized = false;
    this.agents = new Map();
    this.activeAgent = null;
    this.fallbackEnabled = true;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize available agents
      await this.initializeAgents();
      
      this.initialized = true;
      console.log('✅ AgentServiceWrapper initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize AgentServiceWrapper:', error);
      throw error;
    }
  }

  async initializeAgents() {
    // Register Claude agent (main)
    const proxy = getServiceProxy();
    this.agents.set('claude', {
      service: proxy.getService('agentServiceV4Orchestrator'),
      type: 'primary',
      status: 'available',
      capabilities: ['general', 'medical', 'administrative'],
      priority: 1
    });
    
    // Register Gemini agent (medical specialist) - placeholder for future
    this.agents.set('gemini', {
      service: null, // Will be loaded when available
      type: 'specialist',
      status: 'disabled', // Disabled until Google API key issue is resolved
      capabilities: ['medical', 'clinical'],
      priority: 2
    });
    
    // Set default active agent
    this.activeAgent = 'claude';
    
    // Initialize available agents
    for (const [name, agent] of this.agents) {
      if (agent.service && agent.status === 'available') {
        try {
          if (agent.service.initialize) {
            await agent.service.initialize();
            console.log(`✅ Initialized agent: ${name}`);
          }
        } catch (error) {
          console.error(`❌ Failed to initialize agent ${name}:`, error);
          agent.status = 'error';
        }
      }
    }
  }

  async processMessage(message, context = {}) {
    if (!this.initialized) await this.initialize();

    try {
      // Determine best agent for this message
      const selectedAgent = await this.selectAgent(message, context);
      
      if (!selectedAgent) {
        return {
          success: false,
          error: context.session?.language === 'he' 
            ? 'אין סוכן זמין לעיבוד הבקשה' 
            : 'No agent available to process request'
        };
      }
      
      // Process with selected agent
      const result = await this.executeWithAgent(selectedAgent, message, context);
      
      // Add wrapper metadata
      return {
        ...result,
        agentInfo: {
          usedAgent: selectedAgent,
          timestamp: new Date(),
          wrapper: 'agent-service-wrapper'
        }
      };
    } catch (error) {
      console.error('Error in processMessage:', error);
      
      // Try fallback if enabled
      if (this.fallbackEnabled && this.activeAgent !== 'claude') {
        console.log('Attempting fallback to Claude agent...');
        return await this.executeWithAgent('claude', message, context);
      }
      
      return {
        success: false,
        error: context.session?.language === 'he' 
          ? 'שגיאה בעיבוד ההודעה' 
          : 'Error processing message'
      };
    }
  }

  async selectAgent(message, context) {
    // For now, always use Claude as it's the primary and most capable agent
    const claudeAgent = this.agents.get('claude');
    if (claudeAgent && claudeAgent.status === 'available') {
      return 'claude';
    }
    
    // Check if Gemini should be used for medical queries (when available)
    if (this.isMedicalQuery(message)) {
      const geminiAgent = this.agents.get('gemini');
      if (geminiAgent && geminiAgent.status === 'available') {
        return 'gemini';
      }
    }
    
    // Fallback to any available agent
    for (const [name, agent] of this.agents) {
      if (agent.status === 'available') {
        return name;
      }
    }
    
    return null;
  }

  isMedicalQuery(message) {
    const medicalKeywords = [
      'diagnosis', 'symptom', 'treatment', 'medication', 'prescription',
      'vital signs', 'lab result', 'medical history', 'clinical',
      'אבחנה', 'תסמין', 'טיפול', 'תרופה', 'מרשם', 'סימני חיים',
      'תוצאות מעבדה', 'היסטוריה רפואית', 'קליני'
    ];
    
    return medicalKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  async executeWithAgent(agentName, message, context) {
    const agent = this.agents.get(agentName);
    if (!agent || !agent.service) {
      throw new Error(`Agent ${agentName} not available`);
    }

    try {
      // Parse message into function call if needed
      const { functionName, params } = await this.parseMessage(message, context);
      
      // Execute with appropriate method
      if (agent.service.orchestrateRequest) {
        return await agent.service.orchestrateRequest({
          functionName,
          params: { ...params, message },
          practiceContext: context.practiceContext || {},
          session: context.session || {}
        });
      } else if (agent.service.processRequest) {
        return await agent.service.processRequest(
          functionName,
          { ...params, message },
          context.practiceContext || {},
          context.session || {}
        );
      } else {
        // Direct function call
        if (agent.service[functionName]) {
          return await agent.service[functionName](
            { ...params, message },
            context.practiceContext || {},
            context.session || {}
          );
        } else {
          return {
            success: false,
            error: context.session?.language === 'he' 
              ? `פונקציה לא נמצאה: ${functionName}` 
              : `Function not found: ${functionName}`
          };
        }
      }
    } catch (error) {
      console.error(`Error executing with agent ${agentName}:`, error);
      throw error;
    }
  }

  async parseMessage(message, context) {
    // Simple message parsing - in reality this would be more sophisticated
    const lowerMessage = message.toLowerCase();
    
    // Default to searchPatients if message contains patient-related terms
    if (lowerMessage.includes('patient') || lowerMessage.includes('מטופל')) {
      if (lowerMessage.includes('add') || lowerMessage.includes('הוסף')) {
        return {
          functionName: 'addPatient',
          params: this.extractPatientParams(message)
        };
      } else if (lowerMessage.includes('search') || lowerMessage.includes('חפש')) {
        return {
          functionName: 'searchPatients',
          params: { searchTerm: message }
        };
      }
    }
    
    // Schedule related
    if (lowerMessage.includes('schedule') || lowerMessage.includes('לוח זמנים')) {
      return {
        functionName: 'getTodaySchedule',
        params: {}
      };
    }
    
    // Stats related
    if (lowerMessage.includes('stats') || lowerMessage.includes('סטטיסטיקות')) {
      return {
        functionName: 'getQuickStats',
        params: {}
      };
    }
    
    // Default to general query
    return {
      functionName: 'processGeneralQuery',
      params: { query: message }
    };
  }

  extractPatientParams(message) {
    // Simple extraction - would be more sophisticated in practice
    return {
      firstName: 'Unknown',
      lastName: 'Unknown',
      extractedFrom: message
    };
  }

  async switchAgent(agentName) {
    if (!this.agents.has(agentName)) {
      return {
        success: false,
        error: `Agent ${agentName} not found`
      };
    }
    
    const agent = this.agents.get(agentName);
    if (agent.status !== 'available') {
      return {
        success: false,
        error: `Agent ${agentName} is not available (status: ${agent.status})`
      };
    }
    
    this.activeAgent = agentName;
    console.log(`🔄 Switched to agent: ${agentName}`);
    
    return {
      success: true,
      message: `Switched to ${agentName} agent`,
      activeAgent: agentName
    };
  }

  async getAgentStatus() {
    if (!this.initialized) await this.initialize();

    const status = {
      activeAgent: this.activeAgent,
      fallbackEnabled: this.fallbackEnabled,
      agents: {}
    };

    for (const [name, agent] of this.agents) {
      status.agents[name] = {
        type: agent.type,
        status: agent.status,
        capabilities: agent.capabilities,
        priority: agent.priority,
        available: agent.status === 'available' && !!agent.service
      };
    }

    return status;
  }

  async enableFallback() {
    this.fallbackEnabled = true;
    console.log('✅ Fallback enabled');
  }

  async disableFallback() {
    this.fallbackEnabled = false;
    console.log('❌ Fallback disabled');
  }

  async restartAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return false;
    }
    
    try {
      if (agent.service && agent.service.initialize) {
        await agent.service.initialize();
        agent.status = 'available';
        console.log(`🔄 Restarted agent: ${agentName}`);
        return true;
      }
    } catch (error) {
      console.error(`❌ Failed to restart agent ${agentName}:`, error);
      agent.status = 'error';
    }
    
    return false;
  }
}

// Create and export singleton
const agentServiceWrapper = new AgentServiceWrapper();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('agentServiceWrapper', () => agentServiceWrapper);
}

module.exports = agentServiceWrapper;