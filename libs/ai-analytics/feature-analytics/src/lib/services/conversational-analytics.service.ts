/**
 * Conversational Analytics Service - AI Analytics Domain
 * Analyzes conversational data for insights and performance metrics
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const serviceAccountManager = require('../../../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../../../backend/services/secureDataAccess');

export interface ConversationMetrics {
  totalConversations: number;
  averageLength: number;
  averageResponseTime: number;
  completionRate: number;
  satisfactionScore: number;
  topIntents: Array<{ intent: string; count: number; percentage: number }>;
  topFailures: Array<{ error: string; count: number }>;
}

export interface ConversationAnalysis {
  conversationId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  messageCount: number;
  userSatisfaction?: number;
  resolved: boolean;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyTopics: string[];
}

@Injectable()
export class ConversationalAnalyticsService implements OnModuleInit {
  private serviceToken: any;
  private initialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    if (this.initialized) return;
    
    try {
      this.serviceToken = await serviceAccountManager.authenticate('conversational-analytics-service');
      this.initialized = true;
      console.log('✅ Conversational Analytics Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Conversational Analytics Service:', error);
      throw error;
    }
  }

  private getServiceContext(clinicId = 'global') {
    return {
      serviceId: 'conversational-analytics-service',
      operation: 'conversational_analytics',
      clinicId: clinicId,
      apiKey: this.serviceToken?.apiKey || this.serviceToken
    };
  }

  async analyzeConversation(conversationId: string, clinicId?: string): Promise<ConversationAnalysis> {
    const context = this.getServiceContext(clinicId);
    
    // Get conversation messages
    const messages = await SecureDataAccess.query('chat_messages', {
      sessionId: conversationId,
      clinicId: clinicId || 'global'
    }, {
      sort: { timestamp: 1 }
    }, context);

    if (messages.length === 0) {
      throw new Error('Conversation not found');
    }

    const startTime = new Date(messages[0].timestamp);
    const endTime = new Date(messages[messages.length - 1].timestamp);
    const duration = endTime.getTime() - startTime.getTime();

    // Analyze sentiment (simplified)
    const sentiment = this.analyzeSentiment(messages);
    
    // Extract key topics
    const keyTopics = this.extractKeyTopics(messages);
    
    // Determine if conversation was resolved
    const resolved = this.isConversationResolved(messages);
    
    // Categorize conversation
    const category = this.categorizeConversation(messages);

    const analysis: ConversationAnalysis = {
      conversationId,
      startTime,
      endTime,
      duration,
      messageCount: messages.length,
      resolved,
      category,
      sentiment,
      keyTopics
    };

    // Store analysis
    await SecureDataAccess.insert('conversation_analyses', {
      ...analysis,
      clinicId: clinicId || 'global',
      analyzedAt: new Date()
    }, context);

    return analysis;
  }

  async getConversationMetrics(timeRange: { start: Date; end: Date }, clinicId?: string): Promise<ConversationMetrics> {
    const context = this.getServiceContext(clinicId);
    
    // Get conversations in time range
    const conversations = await SecureDataAccess.query('conversation_analyses', {
      startTime: { $gte: timeRange.start, $lte: timeRange.end },
      clinicId: clinicId || 'global'
    }, {}, context);

    if (conversations.length === 0) {
      return {
        totalConversations: 0,
        averageLength: 0,
        averageResponseTime: 0,
        completionRate: 0,
        satisfactionScore: 0,
        topIntents: [],
        topFailures: []
      };
    }

    // Calculate metrics
    const totalConversations = conversations.length;
    const averageLength = conversations.reduce((sum, c) => sum + c.messageCount, 0) / totalConversations;
    const averageResponseTime = conversations.reduce((sum, c) => sum + c.duration, 0) / totalConversations;
    const completionRate = (conversations.filter(c => c.resolved).length / totalConversations) * 100;
    const satisfactionScore = conversations
      .filter(c => c.userSatisfaction)
      .reduce((sum, c) => sum + (c.userSatisfaction || 0), 0) / 
      conversations.filter(c => c.userSatisfaction).length || 0;

    // Top intents/categories
    const categoryCount = new Map<string, number>();
    conversations.forEach(c => {
      categoryCount.set(c.category, (categoryCount.get(c.category) || 0) + 1);
    });

    const topIntents = Array.from(categoryCount.entries())
      .map(([intent, count]) => ({
        intent,
        count,
        percentage: (count / totalConversations) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalConversations,
      averageLength: Math.round(averageLength),
      averageResponseTime: Math.round(averageResponseTime),
      completionRate: Math.round(completionRate),
      satisfactionScore: Math.round(satisfactionScore * 100) / 100,
      topIntents,
      topFailures: [] // Would analyze error logs
    };
  }

  async generateInsights(timeRange: { start: Date; end: Date }, clinicId?: string): Promise<{
    summary: string;
    trends: Array<{ metric: string; trend: 'up' | 'down' | 'stable'; change: number }>;
    recommendations: string[];
    alerts: string[];
  }> {
    const metrics = await this.getConversationMetrics(timeRange, clinicId);
    
    // Compare with previous period
    const previousPeriod = {
      start: new Date(timeRange.start.getTime() - (timeRange.end.getTime() - timeRange.start.getTime())),
      end: timeRange.start
    };
    const previousMetrics = await this.getConversationMetrics(previousPeriod, clinicId);

    // Calculate trends
    const trends = [
      {
        metric: 'Total Conversations',
        trend: this.getTrend(metrics.totalConversations, previousMetrics.totalConversations),
        change: this.getChangePercentage(metrics.totalConversations, previousMetrics.totalConversations)
      },
      {
        metric: 'Completion Rate',
        trend: this.getTrend(metrics.completionRate, previousMetrics.completionRate),
        change: this.getChangePercentage(metrics.completionRate, previousMetrics.completionRate)
      },
      {
        metric: 'Satisfaction Score',
        trend: this.getTrend(metrics.satisfactionScore, previousMetrics.satisfactionScore),
        change: this.getChangePercentage(metrics.satisfactionScore, previousMetrics.satisfactionScore)
      }
    ];

    // Generate recommendations
    const recommendations: string[] = [];
    if (metrics.completionRate < 70) {
      recommendations.push('Consider improving conversation flow to increase completion rate');
    }
    if (metrics.satisfactionScore < 4.0) {
      recommendations.push('Focus on response quality to improve user satisfaction');
    }
    if (metrics.averageResponseTime > 5000) {
      recommendations.push('Optimize response time to improve user experience');
    }

    // Generate alerts
    const alerts: string[] = [];
    if (trends.find(t => t.metric === 'Completion Rate')?.trend === 'down') {
      alerts.push('Completion rate is declining');
    }
    if (trends.find(t => t.metric === 'Satisfaction Score')?.trend === 'down') {
      alerts.push('User satisfaction is declining');
    }

    const summary = `Analyzed ${metrics.totalConversations} conversations with ${metrics.completionRate.toFixed(1)}% completion rate and ${metrics.satisfactionScore.toFixed(1)}/5 satisfaction score.`;

    return {
      summary,
      trends,
      recommendations,
      alerts
    };
  }

  private analyzeSentiment(messages: any[]): 'positive' | 'neutral' | 'negative' {
    // Simplified sentiment analysis
    const positiveKeywords = ['good', 'great', 'excellent', 'thank', 'helpful', 'satisfied'];
    const negativeKeywords = ['bad', 'poor', 'terrible', 'frustrated', 'angry', 'disappointed'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    messages.forEach(msg => {
      if (msg.content && typeof msg.content === 'string') {
        const content = msg.content.toLowerCase();
        positiveKeywords.forEach(word => {
          if (content.includes(word)) positiveScore++;
        });
        negativeKeywords.forEach(word => {
          if (content.includes(word)) negativeScore++;
        });
      }
    });
    
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  private extractKeyTopics(messages: any[]): string[] {
    // Simplified topic extraction
    const medicalKeywords = [
      'appointment', 'prescription', 'symptoms', 'diagnosis', 'treatment',
      'insurance', 'billing', 'medication', 'test', 'result'
    ];
    
    const topics = new Set<string>();
    
    messages.forEach(msg => {
      if (msg.content && typeof msg.content === 'string') {
        const content = msg.content.toLowerCase();
        medicalKeywords.forEach(keyword => {
          if (content.includes(keyword)) {
            topics.add(keyword);
          }
        });
      }
    });
    
    return Array.from(topics).slice(0, 5);
  }

  private isConversationResolved(messages: any[]): boolean {
    // Look for resolution indicators in the last few messages
    const lastMessages = messages.slice(-3);
    const resolutionKeywords = ['solved', 'resolved', 'completed', 'thank you', 'bye', 'goodbye'];
    
    return lastMessages.some(msg => {
      if (msg.content && typeof msg.content === 'string') {
        const content = msg.content.toLowerCase();
        return resolutionKeywords.some(keyword => content.includes(keyword));
      }
      return false;
    });
  }

  private categorizeConversation(messages: any[]): string {
    // Simplified categorization based on keywords
    const categories = {
      'appointment': ['appointment', 'schedule', 'booking', 'calendar'],
      'medical': ['symptoms', 'diagnosis', 'treatment', 'medication', 'prescription'],
      'billing': ['billing', 'payment', 'insurance', 'cost', 'invoice'],
      'support': ['help', 'support', 'issue', 'problem', 'question'],
      'general': []
    };
    
    const allContent = messages
      .map(msg => msg.content || '')
      .join(' ')
      .toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => allContent.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  private getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const change = current - previous;
    const percentChange = previous > 0 ? (change / previous) * 100 : 0;
    
    if (Math.abs(percentChange) < 5) return 'stable';
    return percentChange > 0 ? 'up' : 'down';
  }

  private getChangePercentage(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }
}