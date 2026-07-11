const serviceAccountManager = require('../../../backend/services/serviceAccountManager');

/**
 * Platform Help Service
 * Provides contextual help, documentation, and user guidance
 */
class PlatformHelpService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.helpContent = new Map();
    this.userGuides = new Map();
  }

  async initialize() {
    try {
      this.serviceToken = await serviceAccountManager.authenticate('platform-help-service');
      await this.loadHelpContent();
      this.initialized = true;
      console.log('✅ Platform Help Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Platform Help Service:', error);
      throw error;
    }
  }

  async loadHelpContent() {
    const helpTopics = [
      {
        id: 'patient-management',
        title: 'Patient Management',
        content: 'Learn how to add, edit, and manage patient records',
        keywords: ['patient', 'record', 'add', 'edit', 'manage']
      },
      {
        id: 'appointments',
        title: 'Appointment Scheduling',
        content: 'Schedule and manage patient appointments',
        keywords: ['appointment', 'schedule', 'calendar', 'booking']
      },
      {
        id: 'prescriptions',
        title: 'Prescription Management',
        content: 'Manage prescriptions, refills, and medication history',
        keywords: ['prescription', 'medication', 'refill', 'pharmacy']
      },
      {
        id: 'reports',
        title: 'Reports and Analytics',
        content: 'Generate reports and view analytics dashboards',
        keywords: ['report', 'analytics', 'dashboard', 'statistics']
      }
    ];

    helpTopics.forEach(topic => {
      this.helpContent.set(topic.id, topic);
    });

    // Load user guides
    const guides = [
      {
        id: 'getting-started',
        title: 'Getting Started Guide',
        steps: [
          'Log into the platform',
          'Set up your profile',
          'Add your first patient',
          'Schedule an appointment'
        ]
      },
      {
        id: 'patient-workflow',
        title: 'Patient Management Workflow',
        steps: [
          'Search for existing patient',
          'Create new patient record if needed',
          'Update medical history',
          'Schedule follow-up appointments'
        ]
      }
    ];

    guides.forEach(guide => {
      this.userGuides.set(guide.id, guide);
    });
  }

  async searchHelp(query) {
    const results = [];
    const searchTerms = query.toLowerCase().split(' ');

    for (const [id, topic] of this.helpContent) {
      const relevance = this.calculateRelevance(topic, searchTerms);
      if (relevance > 0) {
        results.push({
          id: topic.id,
          title: topic.title,
          content: topic.content,
          relevance: relevance
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    
    return {
      query: query,
      results: results.slice(0, 10), // Top 10 results
      totalResults: results.length
    };
  }

  calculateRelevance(topic, searchTerms) {
    let relevance = 0;
    
    searchTerms.forEach(term => {
      // Check title
      if (topic.title.toLowerCase().includes(term)) {
        relevance += 3;
      }
      
      // Check keywords
      if (topic.keywords.some(keyword => keyword.includes(term))) {
        relevance += 2;
      }
      
      // Check content
      if (topic.content.toLowerCase().includes(term)) {
        relevance += 1;
      }
    });
    
    return relevance;
  }

  async getContextualHelp(context) {
    // Provide help based on current user context
    const { page, action, userRole } = context;
    
    const contextualHelp = {
      page: page,
      action: action,
      userRole: userRole,
      suggestions: []
    };

    // Generate suggestions based on context
    if (page === 'patient-list') {
      contextualHelp.suggestions = [
        { action: 'add-patient', title: 'Add New Patient', description: 'Click the + button to add a new patient' },
        { action: 'search-patient', title: 'Search Patients', description: 'Use the search bar to find existing patients' }
      ];
    } else if (page === 'appointment-scheduler') {
      contextualHelp.suggestions = [
        { action: 'schedule-appointment', title: 'Schedule Appointment', description: 'Select date and time to schedule' },
        { action: 'view-availability', title: 'Check Availability', description: 'View provider availability calendar' }
      ];
    }

    return contextualHelp;
  }

  async getQuickHelp(functionName) {
    const quickHelpMap = {
      'addPatient': {
        title: 'Add Patient',
        description: 'Create a new patient record in the system',
        requiredFields: ['firstName', 'lastName', 'dateOfBirth'],
        tips: ['Ensure all required fields are filled', 'Verify patient information before saving']
      },
      'scheduleAppointment': {
        title: 'Schedule Appointment',
        description: 'Book an appointment for a patient',
        requiredFields: ['patientId', 'providerId', 'dateTime', 'appointmentType'],
        tips: ['Check provider availability first', 'Confirm appointment details with patient']
      },
      'prescribeMedication': {
        title: 'Prescribe Medication',
        description: 'Create a new prescription for a patient',
        requiredFields: ['patientId', 'medicationName', 'dosage', 'frequency'],
        tips: ['Check for drug interactions', 'Verify patient allergies', 'Include clear instructions']
      }
    };

    return quickHelpMap[functionName] || {
      title: 'Function Help',
      description: 'No specific help available for this function',
      requiredFields: [],
      tips: ['Refer to the main help documentation']
    };
  }

  async getUserGuide(guideId) {
    const guide = this.userGuides.get(guideId);
    if (!guide) {
      return null;
    }

    return {
      ...guide,
      estimatedTime: `${guide.steps.length * 2}-${guide.steps.length * 3} minutes`,
      difficulty: guide.steps.length > 5 ? 'intermediate' : 'beginner'
    };
  }

  async getAllUserGuides() {
    const guides = Array.from(this.userGuides.values());
    return guides.map(guide => ({
      id: guide.id,
      title: guide.title,
      stepCount: guide.steps.length,
      estimatedTime: `${guide.steps.length * 2}-${guide.steps.length * 3} minutes`,
      difficulty: guide.steps.length > 5 ? 'intermediate' : 'beginner'
    }));
  }

  async recordHelpUsage(userId, helpType, topicId) {
    // Track help usage for analytics (would implement with real storage)
    console.log(`Help usage recorded: User ${userId} accessed ${helpType}:${topicId}`);
    
    return {
      userId: userId,
      helpType: helpType,
      topicId: topicId,
      timestamp: new Date(),
      recorded: true
    };
  }

  async getPopularHelpTopics(limit = 10) {
    // Return mock popular help topics (would implement with real analytics)
    return [
      { id: 'patient-management', title: 'Patient Management', accessCount: 156, trend: 'up' },
      { id: 'appointments', title: 'Appointment Scheduling', accessCount: 134, trend: 'stable' },
      { id: 'prescriptions', title: 'Prescription Management', accessCount: 98, trend: 'up' },
      { id: 'reports', title: 'Reports and Analytics', accessCount: 67, trend: 'down' }
    ].slice(0, limit);
  }
}

module.exports = new PlatformHelpService();