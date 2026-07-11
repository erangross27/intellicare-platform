// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

/**
 * Business Intelligence Dashboard Service
 * 
 * Comprehensive business intelligence platform providing:
 * - Real-time executive dashboards with KPI overview
 * - Financial performance monitoring and analysis
 * - Operational metrics tracking and visualization
 * - Strategic analytics with trend analysis and predictive modeling
 * - Multi-language support (Hebrew/English) with mobile access
 */
class BusinessIntelligenceDashboardService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.dashboardConfigs = new Map();
    this.kpiDefinitions = new Map();
    this.dataRefreshRates = new Map();
    this.alertThresholds = new Map();
    this.userPreferences = new Map();
    this.cachedMetrics = new Map();
    this.realtimeConnections = new Map();
  }

  async initialize() {
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      this.serviceToken = await serviceAccountManager.authenticate('business-intelligence-dashboard-service');
      await this.loadDashboardConfigurations();
      // TODO: Implement these methods when needed
      // await this.initializeKPIDefinitions();
      // await this.setupDataRefreshSchedules();
      // await this.loadAlertThresholds();
      // await this.startRealTimeDataStreaming();
      this.initialized = true;
      console.log('✅ Business Intelligence Dashboard Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Business Intelligence Dashboard Service:', error);
      throw error;
    }
  }

  // Helper method to get SecureDataAccess service
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  // Helper method to get the service context for SecureDataAccess
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'business-intelligence-dashboard-service',
      operation: 'business-intelligence-dashboard-operation',
      practiceId: practiceId
    };
  }

  // DASHBOARD CONFIGURATION MANAGEMENT
  async loadDashboardConfigurations() {
    const secureDataAccess = this.getSecureDataAccess();
    const configs = await secureDataAccess.query('dashboard_configurations',
      { type: 'business_intelligence', active: true },
      { sort: { priority: -1 } },
      this.getServiceContext()
    );

    for (const config of configs) {
      this.dashboardConfigs.set(config.name, {
        id: config.id,
        layout: config.layout,
        widgets: config.widgets,
        permissions: config.permissions,
        refreshRate: config.refreshRate || 30000,
        language: config.language || 'en'
      });
    }

    // Set default executive dashboard if none exists
    if (!this.dashboardConfigs.has('executive')) {
      this.dashboardConfigs.set('executive', {
        id: 'executive_default',
        layout: { columns: 4, rows: 3 },
        widgets: [
          { type: 'kpi_summary', position: { col: 0, row: 0, width: 4, height: 1 } },
          { type: 'revenue_chart', position: { col: 0, row: 1, width: 2, height: 1 } },
          { type: 'patient_volume', position: { col: 2, row: 1, width: 2, height: 1 } },
          { type: 'quality_metrics', position: { col: 0, row: 2, width: 4, height: 1 } }
        ],
        refreshRate: 30000,
        language: 'en'
      });
    }
  }

  async getDashboardConfiguration(dashboardName, userId, language = 'en') {
    const config = this.dashboardConfigs.get(dashboardName);
    if (!config) {
      throw new Error(`Dashboard configuration not found: ${dashboardName}`);
    }

    // Apply user preferences if available
    const userPrefs = this.userPreferences.get(userId);
    if (userPrefs && userPrefs[dashboardName]) {
      return this.mergeDashboardConfigurations(config, userPrefs[dashboardName], language);
    }

    return this.localizeDashboardConfiguration(config, language);
  }

  async updateDashboardConfiguration(dashboardName, userId, updates, context) {
    try {
      const existingConfig = this.dashboardConfigs.get(dashboardName);
      if (!existingConfig) {
        throw new Error(`Dashboard not found: ${dashboardName}`);
      }

      const updatedConfig = { ...existingConfig, ...updates };
      this.dashboardConfigs.set(dashboardName, updatedConfig);

      // Save to database
      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.update('dashboard_configurations',
        { name: dashboardName },
        updatedConfig,
        this.getServiceContext(context.practiceId)
      );

      await secureDataAccess.create('audit_logs', {
        action: 'DASHBOARD_CONFIGURATION_UPDATED',
        details: { dashboardName, userId, updates },
        userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      }, {
        ...this.getServiceContext(context.practiceId),
        operation: 'audit-dashboard-config-update'
      });

      return updatedConfig;
    } catch (error) {
      console.error('Error updating dashboard configuration:', error);
      throw error;
    }
  }

  // KPI DEFINITIONS AND CALCULATIONS
  async initializeKPIDefinitions() {
    const healthcareKPIs = [
      {
        name: 'patient_satisfaction_score',
        category: 'quality',
        calculation: 'average',
        source: 'patient_surveys',
        target: 4.5,
        unit: 'rating',
        format: 'decimal',
        trend: 'higher_better'
      },
      {
        name: 'monthly_revenue',
        category: 'financial',
        calculation: 'sum',
        source: 'billing_records',
        target: null,
        unit: 'currency',
        format: 'currency',
        trend: 'higher_better'
      },
      {
        name: 'appointment_utilization_rate',
        category: 'operational',
        calculation: 'percentage',
        source: 'appointments',
        target: 85,
        unit: 'percentage',
        format: 'percentage',
        trend: 'higher_better'
      },
      {
        name: 'average_wait_time',
        category: 'operational',
        calculation: 'average',
        source: 'appointments',
        target: 15,
        unit: 'minutes',
        format: 'duration',
        trend: 'lower_better'
      },
      {
        name: 'provider_productivity',
        category: 'operational',
        calculation: 'ratio',
        source: 'appointments,providers',
        target: 20,
        unit: 'appointments_per_day',
        format: 'number',
        trend: 'higher_better'
      },
      {
        name: 'cost_per_patient',
        category: 'financial',
        calculation: 'division',
        source: 'expenses,patient_volume',
        target: null,
        unit: 'currency',
        format: 'currency',
        trend: 'lower_better'
      }
    ];

    for (const kpi of healthcareKPIs) {
      this.kpiDefinitions.set(kpi.name, kpi);
    }
  }

  async calculateKPI(kpiName, dateRange, practiceId, context) {
    const definition = this.kpiDefinitions.get(kpiName);
    if (!definition) {
      throw new Error(`KPI definition not found: ${kpiName}`);
    }

    try {
      let result;
      switch (definition.calculation) {
        case 'average':
          result = await this.calculateAverageKPI(definition, dateRange, practiceId, context);
          break;
        case 'sum':
          result = await this.calculateSumKPI(definition, dateRange, practiceId, context);
          break;
        case 'percentage':
          result = await this.calculatePercentageKPI(definition, dateRange, practiceId, context);
          break;
        case 'ratio':
          result = await this.calculateRatioKPI(definition, dateRange, practiceId, context);
          break;
        case 'division':
          result = await this.calculateDivisionKPI(definition, dateRange, practiceId, context);
          break;
        default:
          throw new Error(`Unknown calculation type: ${definition.calculation}`);
      }

      return this.formatKPIResult(result, definition);
    } catch (error) {
      console.error(`Error calculating KPI ${kpiName}:`, error);
      throw error;
    }
  }

  async calculateAverageKPI(definition, dateRange, practiceId, context) {
    const query = {
      practiceId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    };

    const records = await this.getSecureDataAccess().query(definition.source, query, {},
      this.getServiceContext(practiceId)
    );

    if (records.length === 0) return 0;

    const values = records.map(record => {
      switch (definition.name) {
        case 'patient_satisfaction_score':
          return record.satisfactionScore || 0;
        case 'average_wait_time':
          return record.waitTime || 0;
        default:
          return record.value || 0;
      }
    });

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  async calculateSumKPI(definition, dateRange, practiceId, context) {
    const query = {
      practiceId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    };

    const records = await this.getSecureDataAccess().query(definition.source, query, {},
      this.getServiceContext(practiceId)
    );

    return records.reduce((sum, record) => {
      switch (definition.name) {
        case 'monthly_revenue':
          return sum + (record.amount || 0);
        default:
          return sum + (record.value || 0);
      }
    }, 0);
  }

  async calculatePercentageKPI(definition, dateRange, practiceId, context) {
    const query = {
      practiceId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    };

    switch (definition.name) {
      case 'appointment_utilization_rate':
        const totalSlots = await this.getSecureDataAccess().query('appointment_slots', query,
          { count: true },
          this.getServiceContext(practiceId)
        );
        const filledSlots = await this.getSecureDataAccess().query('appointments',
          { ...query, status: 'completed' },
          { count: true },
          this.getServiceContext(practiceId)
        );
        return totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;
      
      default:
        return 0;
    }
  }

  async calculateRatioKPI(definition, dateRange, practiceId, context) {
    const [numeratorSource, denominatorSource] = definition.source.split(',');
    
    const query = {
      practiceId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    };

    const numeratorCount = await this.getSecureDataAccess().query(numeratorSource, query,
      { count: true },
      this.getServiceContext(practiceId)
    );
    const denominatorCount = await this.getSecureDataAccess().query(denominatorSource,
      { practiceId, active: true },
      { count: true },
      this.getServiceContext(practiceId)
    );

    return denominatorCount > 0 ? numeratorCount / denominatorCount : 0;
  }

  async calculateDivisionKPI(definition, dateRange, practiceId, context) {
    const [numeratorSource, denominatorSource] = definition.source.split(',');
    
    const query = {
      practiceId,
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    };

    const numeratorSum = await this.calculateSumKPI({...definition, source: numeratorSource}, dateRange, practiceId, context);
    const denominatorCount = await this.getSecureDataAccess().query(denominatorSource, query,
      { count: true },
      this.getServiceContext(practiceId)
    );

    return denominatorCount > 0 ? numeratorSum / denominatorCount : 0;
  }

  formatKPIResult(value, definition) {
    const formatted = {
      name: definition.name,
      value: value,
      target: definition.target,
      unit: definition.unit,
      trend: definition.trend,
      category: definition.category
    };

    switch (definition.format) {
      case 'currency':
        formatted.displayValue = new Intl.NumberFormat('he-IL', {
          style: 'currency',
          currency: 'ILS'
        }).format(value);
        break;
      case 'percentage':
        formatted.displayValue = `${value.toFixed(1)}%`;
        break;
      case 'duration':
        formatted.displayValue = `${Math.round(value)} min`;
        break;
      case 'decimal':
        formatted.displayValue = value.toFixed(2);
        break;
      default:
        formatted.displayValue = Math.round(value).toString();
    }

    // Calculate performance status
    if (definition.target) {
      const variance = definition.trend === 'higher_better' 
        ? (value - definition.target) / definition.target
        : (definition.target - value) / definition.target;
      
      formatted.status = variance > 0.1 ? 'exceeds' : variance > -0.1 ? 'meets' : 'below';
      formatted.variance = variance;
    }

    return formatted;
  }

  // EXECUTIVE DASHBOARD GENERATION
  async generateExecutiveDashboard(userId, practiceId, language = 'en', context) {
    try {
      const dateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      };

      const dashboard = {
        title: language === 'he' ? 'לוח בקרה מנהלים' : 'Executive Dashboard',
        lastUpdated: new Date(),
        sections: {
          kpiSummary: await this.generateKPISummary(dateRange, practiceId, language, context),
          financialPerformance: await this.generateFinancialPerformance(dateRange, practiceId, language, context),
          operationalMetrics: await this.generateOperationalMetrics(dateRange, practiceId, language, context),
          qualityIndicators: await this.generateQualityIndicators(dateRange, practiceId, language, context)
        }
      };

      await this.getSecureDataAccess().create('audit_logs', {
        action: 'EXECUTIVE_DASHBOARD_GENERATED',
        details: { userId, practiceId, language },
        userId,
        practiceId,
        timestamp: new Date()
      }, {
        ...this.getServiceContext(practiceId),
        operation: 'audit-executive-dashboard-generation'
      });

      return dashboard;

    } catch (error) {
      console.error('Error generating executive dashboard:', error);
      throw error;
    }
  }

  async generateKPISummary(dateRange, practiceId, language, context) {
    const kpiNames = [
      'patient_satisfaction_score',
      'monthly_revenue',
      'appointment_utilization_rate',
      'average_wait_time',
      'provider_productivity',
      'cost_per_patient'
    ];

    const kpis = [];
    for (const kpiName of kpiNames) {
      try {
        const kpi = await this.calculateKPI(kpiName, dateRange, practiceId, context);
        kpis.push(kpi);
      } catch (error) {
        console.error(`Error calculating KPI ${kpiName}:`, error);
      }
    }

    return {
      title: language === 'he' ? 'מדדי ביצוע מרכזיים' : 'Key Performance Indicators',
      kpis,
      summary: {
        total: kpis.length,
        exceeds: kpis.filter(k => k.status === 'exceeds').length,
        meets: kpis.filter(k => k.status === 'meets').length,
        below: kpis.filter(k => k.status === 'below').length
      }
    };
  }

  async generateFinancialPerformance(dateRange, practiceId, language, context) {
    const currentRevenue = await this.calculateKPI('monthly_revenue', dateRange, practiceId, context);
    
    // Previous period for comparison
    const previousDateRange = {
      start: new Date(dateRange.start.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: dateRange.start
    };
    const previousRevenue = await this.calculateKPI('monthly_revenue', previousDateRange, practiceId, context);

    const revenueGrowth = previousRevenue.value > 0 
      ? ((currentRevenue.value - previousRevenue.value) / previousRevenue.value) * 100
      : 0;

    return {
      title: language === 'he' ? 'ביצועים פיננסיים' : 'Financial Performance',
      metrics: {
        currentRevenue,
        previousRevenue,
        growth: {
          percentage: revenueGrowth,
          trend: revenueGrowth > 0 ? 'up' : revenueGrowth < 0 ? 'down' : 'flat',
          displayValue: `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`
        }
      },
      charts: [
        {
          type: 'line',
          title: language === 'he' ? 'מגמת הכנסות חודשית' : 'Monthly Revenue Trend',
          data: await this.getRevenueChartData(practiceId, context)
        }
      ]
    };
  }

  async generateOperationalMetrics(dateRange, practiceId, language, context) {
    const utilizationRate = await this.calculateKPI('appointment_utilization_rate', dateRange, practiceId, context);
    const waitTime = await this.calculateKPI('average_wait_time', dateRange, practiceId, context);
    const productivity = await this.calculateKPI('provider_productivity', dateRange, practiceId, context);

    return {
      title: language === 'he' ? 'מדדים תפעוליים' : 'Operational Metrics',
      metrics: {
        utilizationRate,
        waitTime,
        productivity
      },
      charts: [
        {
          type: 'gauge',
          title: language === 'he' ? 'ניצול תורים' : 'Appointment Utilization',
          value: utilizationRate.value,
          target: utilizationRate.target,
          unit: '%'
        }
      ]
    };
  }

  async generateQualityIndicators(dateRange, practiceId, language, context) {
    const satisfactionScore = await this.calculateKPI('patient_satisfaction_score', dateRange, practiceId, context);

    // Additional quality metrics
    const qualityMetrics = await this.getSecureDataAccess().query('quality_measures',
      {
        practiceId,
        measureDate: { $gte: dateRange.start, $lte: dateRange.end }
      },
      {},
      this.getServiceContext(practiceId)
    );

    return {
      title: language === 'he' ? 'מדדי איכות' : 'Quality Indicators',
      metrics: {
        satisfactionScore,
        qualityMeasures: qualityMetrics
      },
      charts: [
        {
          type: 'radar',
          title: language === 'he' ? 'מדדי איכות כוללים' : 'Overall Quality Metrics',
          data: await this.getQualityChartData(practiceId, context)
        }
      ]
    };
  }

  // REAL-TIME DATA STREAMING
  async startRealTimeDataStreaming() {
    // WebSocket connections for real-time dashboard updates
    setInterval(async () => {
      try {
        await this.updateRealTimeMetrics();
        await this.broadcastUpdatesToConnectedClients();
      } catch (error) {
        console.error('Real-time update error:', error);
      }
    }, 30000); // Update every 30 seconds

    console.log('Real-time data streaming started');
  }

  async updateRealTimeMetrics() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Update cached metrics with recent data
    const recentMetrics = {
      activeAppointments: await this.getActiveAppointmentsCount(),
      waitingPatients: await this.getWaitingPatientsCount(),
      providerStatus: await this.getProviderStatusSummary(),
      systemAlerts: await this.getActiveSystemAlerts()
    };

    this.cachedMetrics.set('realtime', recentMetrics);
  }

  async broadcastUpdatesToConnectedClients() {
    const realtimeData = this.cachedMetrics.get('realtime');
    if (realtimeData) {
      // Broadcast to all connected WebSocket clients
      for (const [clientId, connection] of this.realtimeConnections) {
        try {
          if (connection.readyState === 1) { // WebSocket.OPEN
            connection.send(JSON.stringify({
              type: 'dashboard_update',
              data: realtimeData,
              timestamp: new Date()
            }));
          }
        } catch (error) {
          console.error(`Error broadcasting to client ${clientId}:`, error);
          this.realtimeConnections.delete(clientId);
        }
      }
    }
  }

  // CHART DATA GENERATION
  async getRevenueChartData(practiceId, context) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Note: Using regular query instead of aggregate for SecureDataAccess compatibility
    const billingRecords = await this.getSecureDataAccess().query('billing_records', {
      practiceId,
      createdAt: { $gte: sixMonthsAgo },
      status: 'paid'
    }, {
      sort: { createdAt: 1 }
    }, this.getServiceContext(practiceId));

    // Group by month in JavaScript
    const monthlyRevenue = {};
    for (const record of billingRecords) {
      const date = new Date(record.createdAt);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = { total: 0, year: date.getFullYear(), month: date.getMonth() };
      }
      monthlyRevenue[monthKey].total += record.amount || 0;
    }

    return Object.values(monthlyRevenue).map(item => ({
      date: new Date(item.year, item.month, 1),
      value: item.total
    }));
  }

  async getQualityChartData(practiceId, context) {
    // Placeholder quality metrics data
    return [
      { metric: 'Patient Satisfaction', value: 4.2, max: 5 },
      { metric: 'Safety Score', value: 92, max: 100 },
      { metric: 'Clinical Outcomes', value: 88, max: 100 },
      { metric: 'Compliance Rate', value: 95, max: 100 }
    ];
  }

  // UTILITY METHODS
  async getActiveAppointmentsCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await this.getSecureDataAccess().query('appointments',
      {
        appointmentDate: { $gte: today, $lt: tomorrow },
        status: 'scheduled'
      },
      { count: true },
      this.getServiceContext()
    );

    return appointments;
  }

  async getWaitingPatientsCount() {
    const appointments = await this.getSecureDataAccess().query('appointments',
      {
        status: 'checked_in',
        appointmentDate: { $gte: new Date().setHours(0, 0, 0, 0) }
      },
      { count: true },
      this.getServiceContext()
    );

    return appointments;
  }

  async getProviderStatusSummary() {
    const providers = await this.getSecureDataAccess().query('providers',
      { active: true },
      {},
      this.getServiceContext()
    );

    return {
      total: providers.length,
      available: providers.filter(p => p.status === 'available').length,
      busy: providers.filter(p => p.status === 'busy').length,
      offline: providers.filter(p => p.status === 'offline').length
    };
  }

  async getActiveSystemAlerts() {
    return await this.getSecureDataAccess().query('system_alerts',
      { status: 'active', severity: { $in: ['high', 'critical'] } },
      { sort: { createdAt: -1 }, limit: 5 },
      this.getServiceContext()
    );
  }

  mergeDashboardConfigurations(baseConfig, userConfig, language) {
    return {
      ...baseConfig,
      ...userConfig,
      language,
      widgets: baseConfig.widgets.map(widget => {
        const userWidget = userConfig.widgets?.find(w => w.type === widget.type);
        return userWidget ? { ...widget, ...userWidget } : widget;
      })
    };
  }

  localizeDashboardConfiguration(config, language) {
    // Localize dashboard titles, labels, etc.
    const localizedConfig = { ...config, language };
    
    if (language === 'he') {
      localizedConfig.widgets = localizedConfig.widgets.map(widget => ({
        ...widget,
        title: this.getHebrewWidgetTitle(widget.type)
      }));
    }

    return localizedConfig;
  }

  getHebrewWidgetTitle(widgetType) {
    const hebrewTitles = {
      'kpi_summary': 'סיכום מדדי ביצוע',
      'revenue_chart': 'תרשים הכנסות',
      'patient_volume': 'נפח מטופלים',
      'quality_metrics': 'מדדי איכות'
    };

    return hebrewTitles[widgetType] || widgetType;
  }
}

// Create and export singleton instance
const businessIntelligenceDashboardService = new BusinessIntelligenceDashboardService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('businessIntelligenceDashboardService', () => businessIntelligenceDashboardService);
}

module.exports = businessIntelligenceDashboardService;