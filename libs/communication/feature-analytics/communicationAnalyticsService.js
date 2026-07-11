// Communication Analytics Service
// Migrated to DDD NX architecture - Communication Context - Analytics Feature
// Advanced analytics for SMS, email, and portal communications

// Use lazy loading to resolve circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    // For libs/communication/feature-analytics/:
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Communication Analytics Service
 * Provides comprehensive analytics for all communication channels
 */
class CommunicationAnalyticsService {
  constructor() {
    this.serviceId = 'communication-analytics-service';
    this.serviceToken = null;
    this.initialized = false;
    
    // Analytics metrics
    this.metrics = {
      // Delivery metrics
      DELIVERY_RATE: 'delivery_rate',
      OPEN_RATE: 'open_rate',
      CLICK_RATE: 'click_rate',
      RESPONSE_RATE: 'response_rate',
      BOUNCE_RATE: 'bounce_rate',
      UNSUBSCRIBE_RATE: 'unsubscribe_rate',
      
      // Engagement metrics
      READ_TIME: 'read_time',
      INTERACTION_DEPTH: 'interaction_depth',
      CONVERSION_RATE: 'conversion_rate',
      
      // Timing metrics
      OPTIMAL_SEND_TIME: 'optimal_send_time',
      RESPONSE_TIME: 'response_time',
      
      // Channel effectiveness
      CHANNEL_PREFERENCE: 'channel_preference',
      CROSS_CHANNEL_JOURNEY: 'cross_channel_journey'
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      
      // Get services via lazy loading
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      const secureConfigService = proxy.getService('secureConfigService');
      await secureConfigService.initialize();
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'communicationAnalyticsService',
        timestamp: new Date()
      }, context);
      
      console.log('✅ CommunicationAnalyticsService initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ CommunicationAnalyticsService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive communication analytics
   */
  async getCommunicationAnalytics(params, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        timeRange = 30,
        startDate,
        endDate,
        communicationType = 'all', // sms, email, portal, all
        segmentBy = 'overall', // overall, demographic, condition, provider
        includeComparisons = true
      } = params;

      // Calculate date range
      const endDateObj = endDate ? new Date(endDate) : new Date();
      const startDateObj = startDate ? new Date(startDate) : new Date(Date.now() - (timeRange * 24 * 60 * 60 * 1000));

      // Get communication data
      const communicationData = await this.getCommunicationData(
        startDateObj, 
        endDateObj, 
        communicationType, 
        practiceContext
      );

      // Get patient data for segmentation
      const patientData = segmentBy !== 'overall' ? await this.getPatientSegmentationData(practiceContext) : null;

      // Calculate analytics
      const analytics = {
        summary: await this.calculateSummaryMetrics(communicationData),
        deliveryMetrics: await this.calculateDeliveryMetrics(communicationData),
        engagementMetrics: await this.calculateEngagementMetrics(communicationData),
        timingAnalysis: await this.calculateTimingAnalysis(communicationData),
        channelAnalysis: await this.calculateChannelAnalysis(communicationData),
        segmentedAnalysis: segmentBy !== 'overall' ? 
          await this.calculateSegmentedAnalysis(communicationData, patientData, segmentBy) : null,
        trends: await this.calculateTrends(communicationData, startDateObj, endDateObj),
        recommendations: await this.generateRecommendations(communicationData)
      };

      // Add comparison data if requested
      if (includeComparisons) {
        const previousPeriod = await this.getPreviousPeriodComparison(
          startDateObj, 
          endDateObj, 
          communicationType, 
          practiceContext
        );
        analytics.comparison = previousPeriod;
      }

      return {
        success: true,
        analytics,
        metadata: {
          timeRange: { startDate: startDateObj, endDate: endDateObj },
          dataPoints: communicationData.length,
          segmentBy,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('Failed to get communication analytics:', error);
      throw error;
    }
  }

  /**
   * Get communication data from database
   */
  async getCommunicationData(startDate, endDate, type, practiceContext) {
    const context = {
      serviceId: this.serviceId,
      operation: 'get-communication-data',
      practiceId: practiceContext.practiceId || 'global'
    };

    const data = [];

    // Get SMS communications
    if (type === 'all' || type === 'sms') {
      const proxy = getServiceProxy();
      const secureDataAccess = proxy.getService('secureDataAccess');
      
      const smsData = await secureDataAccess.query('sms_communications', {
        practiceId: practiceContext.practiceId || 'global',
        sentAt: { $gte: startDate, $lte: endDate }
      }, {}, context);
      
      data.push(...smsData.map(item => ({ ...item, channel: 'sms' })));
    }

    // Get Email communications
    if (type === 'all' || type === 'email') {
      const emailData = await secureDataAccess.query('email_communications', {
        practiceId: practiceContext.practiceId || 'global',
        sentAt: { $gte: startDate, $lte: endDate }
      }, {}, context);
      
      data.push(...emailData.map(item => ({ ...item, channel: 'email' })));
    }

    // Get Portal communications
    if (type === 'all' || type === 'portal') {
      const portalData = await secureDataAccess.query('portal_communications', {
        practiceId: practiceContext.practiceId || 'global',
        sentAt: { $gte: startDate, $lte: endDate }
      }, {}, context);
      
      data.push(...portalData.map(item => ({ ...item, channel: 'portal' })));
    }

    return data.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
  }

  /**
   * Calculate summary metrics
   */
  async calculateSummaryMetrics(data) {
    const total = data.length;
    const delivered = data.filter(item => item.status === 'delivered').length;
    const opened = data.filter(item => item.openedAt).length;
    const clicked = data.filter(item => item.clickedAt).length;
    const responded = data.filter(item => item.respondedAt).length;

    return {
      totalCommunications: total,
      deliveredCount: delivered,
      openedCount: opened,
      clickedCount: clicked,
      respondedCount: responded,
      
      deliveryRate: total > 0 ? (delivered / total * 100).toFixed(2) : 0,
      openRate: delivered > 0 ? (opened / delivered * 100).toFixed(2) : 0,
      clickRate: opened > 0 ? (clicked / opened * 100).toFixed(2) : 0,
      responseRate: delivered > 0 ? (responded / delivered * 100).toFixed(2) : 0,

      byChannel: {
        sms: {
          total: data.filter(item => item.channel === 'sms').length,
          delivered: data.filter(item => item.channel === 'sms' && item.status === 'delivered').length
        },
        email: {
          total: data.filter(item => item.channel === 'email').length,
          delivered: data.filter(item => item.channel === 'email' && item.status === 'delivered').length
        },
        portal: {
          total: data.filter(item => item.channel === 'portal').length,
          delivered: data.filter(item => item.channel === 'portal' && item.status === 'delivered').length
        }
      }
    };
  }

  /**
   * Calculate delivery metrics
   */
  async calculateDeliveryMetrics(data) {
    const deliveryAnalysis = {
      byStatus: {},
      byChannel: {},
      byTimeOfDay: {},
      byDayOfWeek: {},
      bounceAnalysis: {},
      deliveryTimes: []
    };

    // Group by delivery status
    data.forEach(item => {
      const status = item.status || 'unknown';
      deliveryAnalysis.byStatus[status] = (deliveryAnalysis.byStatus[status] || 0) + 1;
    });

    // Group by channel
    data.forEach(item => {
      const channel = item.channel;
      if (!deliveryAnalysis.byChannel[channel]) {
        deliveryAnalysis.byChannel[channel] = {
          total: 0,
          delivered: 0,
          failed: 0,
          pending: 0
        };
      }
      deliveryAnalysis.byChannel[channel].total++;
      deliveryAnalysis.byChannel[channel][item.status || 'unknown']++;
    });

    // Group by time of day
    data.forEach(item => {
      const hour = new Date(item.sentAt).getHours();
      const timeSlot = this.getTimeSlot(hour);
      if (!deliveryAnalysis.byTimeOfDay[timeSlot]) {
        deliveryAnalysis.byTimeOfDay[timeSlot] = { total: 0, delivered: 0 };
      }
      deliveryAnalysis.byTimeOfDay[timeSlot].total++;
      if (item.status === 'delivered') {
        deliveryAnalysis.byTimeOfDay[timeSlot].delivered++;
      }
    });

    // Group by day of week
    data.forEach(item => {
      const dayOfWeek = new Date(item.sentAt).toLocaleDateString('en-US', { weekday: 'long' });
      if (!deliveryAnalysis.byDayOfWeek[dayOfWeek]) {
        deliveryAnalysis.byDayOfWeek[dayOfWeek] = { total: 0, delivered: 0 };
      }
      deliveryAnalysis.byDayOfWeek[dayOfWeek].total++;
      if (item.status === 'delivered') {
        deliveryAnalysis.byDayOfWeek[dayOfWeek].delivered++;
      }
    });

    // Calculate delivery times
    data.filter(item => item.deliveredAt && item.sentAt).forEach(item => {
      const deliveryTime = new Date(item.deliveredAt) - new Date(item.sentAt);
      deliveryAnalysis.deliveryTimes.push(deliveryTime / 1000); // in seconds
    });

    return deliveryAnalysis;
  }

  /**
   * Calculate engagement metrics
   */
  async calculateEngagementMetrics(data) {
    const engagement = {
      overallEngagement: 0,
      byChannel: {},
      byContent: {},
      readTimes: [],
      interactionDepth: {},
      conversionFunnel: {
        delivered: 0,
        opened: 0,
        clicked: 0,
        responded: 0,
        converted: 0
      }
    };

    // Calculate funnel metrics
    data.forEach(item => {
      if (item.status === 'delivered') engagement.conversionFunnel.delivered++;
      if (item.openedAt) engagement.conversionFunnel.opened++;
      if (item.clickedAt) engagement.conversionFunnel.clicked++;
      if (item.respondedAt) engagement.conversionFunnel.responded++;
      if (item.convertedAt) engagement.conversionFunnel.converted++;

      // Calculate read times
      if (item.openedAt && item.closedAt) {
        const readTime = new Date(item.closedAt) - new Date(item.openedAt);
        engagement.readTimes.push(readTime / 1000); // in seconds
      }
    });

    // Calculate engagement by channel
    ['sms', 'email', 'portal'].forEach(channel => {
      const channelData = data.filter(item => item.channel === channel);
      const delivered = channelData.filter(item => item.status === 'delivered').length;
      const engaged = channelData.filter(item => item.openedAt || item.clickedAt || item.respondedAt).length;
      
      engagement.byChannel[channel] = {
        total: channelData.length,
        delivered: delivered,
        engaged: engaged,
        engagementRate: delivered > 0 ? (engaged / delivered * 100).toFixed(2) : 0
      };
    });

    return engagement;
  }

  /**
   * Calculate timing analysis
   */
  async calculateTimingAnalysis(data) {
    const timing = {
      optimalSendTimes: {},
      responsePatterns: {},
      seasonalTrends: {},
      averageResponseTime: 0
    };

    // Calculate optimal send times by hour
    for (let hour = 0; hour < 24; hour++) {
      const hourData = data.filter(item => new Date(item.sentAt).getHours() === hour);
      const delivered = hourData.filter(item => item.status === 'delivered').length;
      const engaged = hourData.filter(item => item.openedAt || item.clickedAt).length;
      
      timing.optimalSendTimes[hour] = {
        total: hourData.length,
        delivered: delivered,
        engaged: engaged,
        engagementRate: delivered > 0 ? (engaged / delivered * 100).toFixed(2) : 0
      };
    }

    // Calculate response times
    const responseTimes = data
      .filter(item => item.sentAt && item.respondedAt)
      .map(item => (new Date(item.respondedAt) - new Date(item.sentAt)) / 1000 / 60); // in minutes

    timing.averageResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0;

    return timing;
  }

  /**
   * Calculate channel analysis
   */
  async calculateChannelAnalysis(data) {
    const analysis = {
      channelPreferences: {},
      crossChannelJourney: {},
      channelEffectiveness: {}
    };

    // Analyze channel effectiveness
    ['sms', 'email', 'portal'].forEach(channel => {
      const channelData = data.filter(item => item.channel === channel);
      const delivered = channelData.filter(item => item.status === 'delivered').length;
      const opened = channelData.filter(item => item.openedAt).length;
      const clicked = channelData.filter(item => item.clickedAt).length;
      const responded = channelData.filter(item => item.respondedAt).length;

      analysis.channelEffectiveness[channel] = {
        total: channelData.length,
        delivered: delivered,
        deliveryRate: channelData.length > 0 ? (delivered / channelData.length * 100).toFixed(2) : 0,
        openRate: delivered > 0 ? (opened / delivered * 100).toFixed(2) : 0,
        clickRate: opened > 0 ? (clicked / opened * 100).toFixed(2) : 0,
        responseRate: delivered > 0 ? (responded / delivered * 100).toFixed(2) : 0
      };
    });

    return analysis;
  }

  /**
   * Get patient segmentation data
   */
  async getPatientSegmentationData(practiceContext) {
    const context = {
      serviceId: this.serviceId,
      operation: 'get-patient-segmentation-data',
      practiceId: practiceContext.practiceId || 'global'
    };

    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    
    const patients = await secureDataAccess.query('patients', {
      practiceId: practiceContext.practiceId || 'global'
    }, {}, context);

    return patients;
  }

  /**
   * Calculate segmented analysis
   */
  async calculateSegmentedAnalysis(communicationData, patientData, segmentBy) {
    const segmentedAnalysis = {};

    if (segmentBy === 'demographic') {
      // Segment by age groups
      const ageGroups = ['18-30', '31-45', '46-60', '61-75', '75+'];
      ageGroups.forEach(ageGroup => {
        const relevantPatients = this.getPatientsByAgeGroup(patientData, ageGroup);
        const relevantCommunications = communicationData.filter(comm => 
          relevantPatients.some(patient => patient._id === comm.patientId)
        );
        segmentedAnalysis[ageGroup] = this.calculateSummaryMetrics(relevantCommunications);
      });
    }

    return segmentedAnalysis;
  }

  /**
   * Calculate trends
   */
  async calculateTrends(data, startDate, endDate) {
    const trends = {
      dailyTrends: {},
      weeklyTrends: {},
      monthlyTrends: {}
    };

    // Calculate daily trends
    const dailyData = {};
    data.forEach(item => {
      const date = new Date(item.sentAt).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { total: 0, delivered: 0, opened: 0, clicked: 0 };
      }
      dailyData[date].total++;
      if (item.status === 'delivered') dailyData[date].delivered++;
      if (item.openedAt) dailyData[date].opened++;
      if (item.clickedAt) dailyData[date].clicked++;
    });

    trends.dailyTrends = dailyData;

    return trends;
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations(data) {
    const recommendations = [];

    // Analyze delivery rates by channel
    const channelStats = {};
    ['sms', 'email', 'portal'].forEach(channel => {
      const channelData = data.filter(item => item.channel === channel);
      const delivered = channelData.filter(item => item.status === 'delivered').length;
      channelStats[channel] = {
        total: channelData.length,
        deliveryRate: channelData.length > 0 ? delivered / channelData.length : 0
      };
    });

    // Recommend best performing channel
    const bestChannel = Object.entries(channelStats)
      .sort(([,a], [,b]) => b.deliveryRate - a.deliveryRate)[0];
    
    if (bestChannel && bestChannel[1].deliveryRate > 0.8) {
      recommendations.push({
        type: 'channel_optimization',
        priority: 'high',
        title: 'Optimize Channel Usage',
        description: `${bestChannel[0].toUpperCase()} shows the highest delivery rate at ${(bestChannel[1].deliveryRate * 100).toFixed(1)}%. Consider prioritizing this channel for critical communications.`
      });
    }

    // Analyze optimal timing
    const hourlyEngagement = {};
    for (let hour = 0; hour < 24; hour++) {
      const hourData = data.filter(item => new Date(item.sentAt).getHours() === hour);
      const engaged = hourData.filter(item => item.openedAt || item.clickedAt).length;
      hourlyEngagement[hour] = hourData.length > 0 ? engaged / hourData.length : 0;
    }

    const bestHour = Object.entries(hourlyEngagement)
      .sort(([,a], [,b]) => b - a)[0];

    if (bestHour && bestHour[1] > 0.3) {
      recommendations.push({
        type: 'timing_optimization',
        priority: 'medium',
        title: 'Optimize Send Time',
        description: `Communications sent at ${bestHour[0]}:00 show ${(bestHour[1] * 100).toFixed(1)}% engagement rate. Consider scheduling important messages during this time.`
      });
    }

    return recommendations;
  }

  /**
   * Get previous period comparison
   */
  async getPreviousPeriodComparison(startDate, endDate, communicationType, practiceContext) {
    const periodLength = endDate - startDate;
    const previousStart = new Date(startDate.getTime() - periodLength);
    const previousEnd = new Date(endDate.getTime() - periodLength);

    const previousData = await this.getCommunicationData(
      previousStart, 
      previousEnd, 
      communicationType, 
      practiceContext
    );

    return {
      summary: await this.calculateSummaryMetrics(previousData),
      periodLength: periodLength / (24 * 60 * 60 * 1000), // days
      previousPeriod: { start: previousStart, end: previousEnd }
    };
  }

  // Utility methods
  getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  getPatientsByAgeGroup(patients, ageGroup) {
    return patients.filter(patient => {
      const age = this.calculateAge(patient.dateOfBirth);
      switch (ageGroup) {
        case '18-30': return age >= 18 && age <= 30;
        case '31-45': return age >= 31 && age <= 45;
        case '46-60': return age >= 46 && age <= 60;
        case '61-75': return age >= 61 && age <= 75;
        case '75+': return age > 75;
        default: return false;
      }
    });
  }

  calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      metricsAvailable: Object.keys(this.metrics).length,
      supportedChannels: ['sms', 'email', 'portal']
    };
  }
}

// Create and export singleton
const communicationAnalyticsService = new CommunicationAnalyticsService();

// Register service with ServiceProxyManager for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('communicationAnalyticsService', () => communicationAnalyticsService);
}

module.exports = communicationAnalyticsService;