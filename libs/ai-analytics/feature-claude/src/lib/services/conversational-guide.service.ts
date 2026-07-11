/**
 * Conversational Guide Service - AI Analytics Domain (Claude)
 * Provides AI-powered conversational guidance for healthcare workflows
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface ConversationContext {
  userId: string;
  sessionId: string;
  clinicId?: string;
  currentWorkflow?: string;
  patientId?: string;
  specialty?: string;
}

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  action?: string;
  next?: string[];
  validations?: string[];
  tips?: string[];
}

export interface ConversationalGuide {
  id: string;
  name: string;
  description: string;
  specialty: string;
  steps: GuideStep[];
  triggers: string[];
  priority: number;
}

@Injectable()
export class ConversationalGuideService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;
  private activeGuides = new Map<string, ConversationalGuide>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('conversational-guide-service');
      await this.loadGuides();
      this.initialized = true;
      console.log('✅ Conversational Guide Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Conversational Guide Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'conversational-guide-service',
      operation: 'guide_management',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async getRelevantGuide(context: ConversationContext): Promise<ConversationalGuide | null> {
    const guides = Array.from(this.activeGuides.values());
    
    // Find the most relevant guide based on context
    const relevantGuides = guides.filter(guide => {
      if (context.specialty && guide.specialty !== 'general' && guide.specialty !== context.specialty) {
        return false;
      }
      
      if (context.currentWorkflow && !guide.triggers.includes(context.currentWorkflow)) {
        return false;
      }
      
      return true;
    });
    
    if (relevantGuides.length === 0) {
      return null;
    }
    
    // Return highest priority guide
    return relevantGuides.sort((a, b) => b.priority - a.priority)[0];
  }

  async generateGuidance(context: ConversationContext, userInput: string): Promise<{
    message: string;
    suggestions: string[];
    nextSteps: string[];
    guide?: ConversationalGuide;
  }> {
    const guide = await this.getRelevantGuide(context);
    
    if (!guide) {
      return {
        message: "I'm here to help! What would you like assistance with?",
        suggestions: [
          "Patient intake",
          "Medical documentation",
          "Billing procedures",
          "Compliance questions"
        ],
        nextSteps: []
      };
    }
    
    // Analyze user input and provide contextual guidance
    const currentStep = this.identifyCurrentStep(guide, userInput);
    const guidance = this.generateStepGuidance(currentStep, context);
    
    // Log the guidance interaction
    await this.logGuidanceInteraction(context, userInput, guidance.message);
    
    return {
      message: guidance.message,
      suggestions: guidance.suggestions,
      nextSteps: guidance.nextSteps,
      guide
    };
  }

  private identifyCurrentStep(guide: ConversationalGuide, userInput: string): GuideStep {
    // Simple keyword matching - in production this would use NLP
    const normalizedInput = userInput.toLowerCase();
    
    for (const step of guide.steps) {
      const keywords = step.description.toLowerCase().split(' ');
      if (keywords.some(keyword => normalizedInput.includes(keyword))) {
        return step;
      }
    }
    
    // Return first step if no match
    return guide.steps[0];
  }

  private generateStepGuidance(step: GuideStep, context: ConversationContext): {
    message: string;
    suggestions: string[];
    nextSteps: string[];
  } {
    const message = `${step.title}: ${step.description}`;
    
    const suggestions = step.tips || [
      "Need more details about this step?",
      "Skip to next step",
      "Go back to previous step"
    ];
    
    const nextSteps = step.next || [];
    
    return { message, suggestions, nextSteps };
  }

  async createGuide(guide: Omit<ConversationalGuide, 'id'>, clinicId?: string): Promise<string> {
    const context = this.getServiceContext(clinicId);
    
    const conversationalGuide: ConversationalGuide = {
      ...guide,
      id: require('crypto').randomUUID()
    };

    await SecureDataAccess.insert('conversational_guides', {
      ...conversationalGuide,
      clinicId: clinicId || 'global',
      createdAt: new Date()
    }, context);

    this.activeGuides.set(conversationalGuide.id, conversationalGuide);
    
    return conversationalGuide.id;
  }

  async updateGuide(guideId: string, updates: Partial<ConversationalGuide>, clinicId?: string): Promise<boolean> {
    const context = this.getServiceContext(clinicId);
    
    try {
      await SecureDataAccess.update('conversational_guides', {
        id: guideId,
        clinicId: clinicId || 'global'
      }, {
        $set: { ...updates, updatedAt: new Date() }
      }, context);

      // Update in memory
      if (this.activeGuides.has(guideId)) {
        const existingGuide = this.activeGuides.get(guideId)!;
        this.activeGuides.set(guideId, { ...existingGuide, ...updates });
      }

      return true;
    } catch (error) {
      console.error('Failed to update guide:', error);
      return false;
    }
  }

  private async loadGuides(clinicId?: string) {
    const context = this.getServiceContext(clinicId);
    
    try {
      const guides = await SecureDataAccess.query('conversational_guides', {
        clinicId: clinicId || 'global'
      }, {}, context);

      for (const guide of guides) {
        this.activeGuides.set(guide.id, guide);
      }

      console.log(`Loaded ${guides.length} conversational guides`);
    } catch (error) {
      console.warn('Could not load existing guides:', error.message);
      // Initialize with default guides
      await this.initializeDefaultGuides(clinicId);
    }
  }

  private async initializeDefaultGuides(clinicId?: string) {
    const defaultGuides: Omit<ConversationalGuide, 'id'>[] = [
      {
        name: 'Patient Intake Guide',
        description: 'Step-by-step guidance for patient intake process',
        specialty: 'general',
        priority: 100,
        triggers: ['patient_intake', 'new_patient', 'registration'],
        steps: [
          {
            id: 'step1',
            title: 'Patient Information',
            description: 'Collect basic patient demographics and contact information',
            action: 'collect_demographics',
            tips: ['Verify ID documents', 'Update emergency contacts'],
            next: ['step2']
          },
          {
            id: 'step2',
            title: 'Insurance Verification',
            description: 'Verify patient insurance coverage and benefits',
            action: 'verify_insurance',
            tips: ['Check coverage limits', 'Verify copay amounts'],
            next: ['step3']
          },
          {
            id: 'step3',
            title: 'Medical History',
            description: 'Document patient medical history and current medications',
            action: 'collect_history',
            tips: ['Ask about allergies', 'Document current medications'],
            next: []
          }
        ]
      },
      {
        name: 'Clinical Documentation Guide',
        description: 'Guidance for proper clinical documentation',
        specialty: 'general',
        priority: 90,
        triggers: ['documentation', 'notes', 'charting'],
        steps: [
          {
            id: 'step1',
            title: 'SOAP Note Structure',
            description: 'Use SOAP (Subjective, Objective, Assessment, Plan) format',
            tips: ['Include patient complaints', 'Document vital signs', 'Provide clear assessment'],
            next: ['step2']
          },
          {
            id: 'step2',
            title: 'Compliance Check',
            description: 'Ensure documentation meets regulatory requirements',
            tips: ['Include required elements', 'Sign and date all entries'],
            next: []
          }
        ]
      }
    ];

    for (const guide of defaultGuides) {
      try {
        await this.createGuide(guide, clinicId);
      } catch (error) {
        console.warn('Could not create default guide:', guide.name);
      }
    }
  }

  private async logGuidanceInteraction(context: ConversationContext, userInput: string, guidance: string) {
    const logContext = this.getServiceContext(context.clinicId);
    
    await SecureDataAccess.insert('audit_logs', {
      action: 'GUIDANCE_PROVIDED',
      details: {
        userId: context.userId,
        sessionId: context.sessionId,
        userInput: userInput.substring(0, 100), // Truncate for privacy
        guidance: guidance.substring(0, 200),
        workflow: context.currentWorkflow
      },
      timestamp: new Date(),
      serviceId: 'conversational-guide-service'
    }, logContext);
  }

  async getGuidanceAnalytics(timeRange: number = 24 * 60 * 60 * 1000, clinicId?: string): Promise<any> {
    const context = this.getServiceContext(clinicId);
    const startTime = new Date(Date.now() - timeRange);

    const interactions = await SecureDataAccess.query('audit_logs', {
      action: 'GUIDANCE_PROVIDED',
      timestamp: { $gte: startTime },
      clinicId: clinicId || 'global'
    }, {}, context);

    const analytics = {
      totalInteractions: interactions.length,
      uniqueUsers: new Set(interactions.map(i => i.details.userId)).size,
      topWorkflows: {} as Record<string, number>,
      averageInteractionsPerUser: 0
    };

    // Count workflows
    interactions.forEach(interaction => {
      const workflow = interaction.details.workflow || 'unknown';
      analytics.topWorkflows[workflow] = (analytics.topWorkflows[workflow] || 0) + 1;
    });

    analytics.averageInteractionsPerUser = analytics.uniqueUsers > 0 ? 
      Math.round(analytics.totalInteractions / analytics.uniqueUsers) : 0;

    return analytics;
  }
}