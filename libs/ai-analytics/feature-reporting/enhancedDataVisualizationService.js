/**
 * Enhanced Data Visualization Service - Modular Version
 * Advanced data visualization platform with interactive charts, dashboards,
 * and healthcare-specific visualizations supporting Hebrew/English interfaces.
 */

const crypto = require('crypto');
const path = require('path');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class EnhancedDataVisualizationService {
  constructor() {
    this.serviceId = 'enhanced-data-visualization-service';
    this.serviceToken = null;
    this.initialized = false;
    this.chartTemplates = new Map();
    this.dashboardLayouts = new Map();
    this.visualizationCache = new Map();
    this.realtimeStreams = new Map();
    
    // Healthcare-specific chart types
    this.medicalChartTypes = {
      PATIENT_FLOW: 'patient_flow_chart',
      VITAL_SIGNS_TIMELINE: 'vital_signs_timeline',
      MEDICATION_ADHERENCE: 'medication_adherence_chart',
      CLINICAL_OUTCOMES: 'clinical_outcomes_dashboard',
      POPULATION_HEALTH: 'population_health_map',
      QUALITY_METRICS: 'quality_metrics_scorecard',
      REVENUE_WATERFALL: 'revenue_waterfall_chart',
      APPOINTMENT_HEATMAP: 'appointment_heatmap',
      PROVIDER_PERFORMANCE: 'provider_performance_radar',
      COMPLIANCE_DASHBOARD: 'compliance_status_dashboard'
    };

    // Color palettes for healthcare data
    this.colorPalettes = {
      clinical: ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#E8B4CB'],
      financial: ['#1B5E20', '#2E7D32', '#43A047', '#66BB6A', '#81C784'],
      operational: ['#0D47A1', '#1565C0', '#1976D2', '#1E88E5', '#42A5F5'],
      quality: ['#4A148C', '#6A1B9A', '#7B1FA2', '#8E24AA', '#9C27B0'],
      compliance: ['#BF360C', '#D84315', '#E64A19', '#FF5722', '#FF6F00']
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Initialize chart templates
      await this.initializeChartTemplates();
      
      // Load dashboard layouts
      await this.loadDashboardLayouts();
      
      // Start real-time streaming
      this.startRealtimeDataStreaming();
      
      // Initialize cache cleanup
      this.startCacheCleanup();
      
      this.initialized = true;
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      const secureDataAccess = proxy.getService('secureDataAccess');
      await secureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'enhanced-data-visualization-service',
        timestamp: new Date()
      }, context);
      
      console.log('✅ Enhanced Data Visualization Service initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Data Visualization Service:', error);
      throw error;
    }
  }

  // Helper method to get SecureDataAccess service
  getSecureDataAccess() {
    return getServiceProxy().getService('secureDataAccess');
  }

  /**
   * Create interactive healthcare dashboard
   */
  async createInteractiveDashboard(dashboardConfig, context) {
    try {
      const dashboard = {
        id: `dashboard_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        title: dashboardConfig.title,
        description: dashboardConfig.description,
        layout: dashboardConfig.layout || 'grid',
        theme: dashboardConfig.theme || 'healthcare',
        language: dashboardConfig.language || 'en',
        widgets: [],
        filters: dashboardConfig.filters || {},
        refreshInterval: dashboardConfig.refreshInterval || 300000, // 5 minutes
        createdBy: context.userId,
        practiceId: context.practiceId,
        createdAt: new Date()
      };

      // Create widgets based on configuration
      for (const widgetConfig of dashboardConfig.widgets || []) {
        const widget = await this.createDashboardWidget(widgetConfig, dashboard.language, context);
        dashboard.widgets.push(widget);
      }

      // Apply responsive layout
      dashboard.responsiveLayout = this.generateResponsiveLayout(dashboard.widgets, dashboard.layout);

      // Generate CSS for RTL support if Hebrew
      if (dashboard.language === 'he') {
        dashboard.rtlStyles = this.generateRTLStyles(dashboard);
      }

      // Store dashboard using SecureDataAccess
      const secureContext = {
        serviceId: this.serviceId,
        operation: 'create_dashboard',
        practiceId: context.practiceId
      };

      const secureDataAccess = this.getSecureDataAccess();
      await secureDataAccess.create(
        'visualization_dashboards',
        dashboard,
        secureContext
      );

      // Log dashboard creation
      await AuditLog.create({
        action: 'CREATE_DASHBOARD',
        details: {
          dashboardId: dashboard.id,
          title: dashboard.title,
          widgetCount: dashboard.widgets.length
        },
        userId: context.userId,
        practiceId: context.practiceId,
        timestamp: new Date()
      });

      return dashboard;
    } catch (error) {
      console.error('Dashboard creation failed:', error);
      throw error;
    }
  }

  /**
   * Create dashboard widget
   */
  async createDashboardWidget(widgetConfig, language, context) {
    const widget = {
      id: `widget_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      type: widgetConfig.type,
      title: this.getLocalizedText(widgetConfig.title, language),
      position: widgetConfig.position || { x: 0, y: 0, width: 4, height: 3 },
      dataSource: widgetConfig.dataSource,
      chartConfig: {},
      filters: widgetConfig.filters || {},
      refreshRate: widgetConfig.refreshRate || 'auto',
      interactive: widgetConfig.interactive !== false,
      exportable: widgetConfig.exportable !== false
    };

    // Generate chart configuration based on widget type
    switch (widget.type) {
      case this.medicalChartTypes.PATIENT_FLOW:
        widget.chartConfig = await this.createPatientFlowChart(widgetConfig, language, context);
        break;
      case this.medicalChartTypes.VITAL_SIGNS_TIMELINE:
        widget.chartConfig = await this.createVitalSignsTimeline(widgetConfig, language, context);
        break;
      case this.medicalChartTypes.MEDICATION_ADHERENCE:
        widget.chartConfig = await this.createMedicationAdherenceChart(widgetConfig, language, context);
        break;
      default:
        // Fall back to generic chart
        widget.chartConfig = await this.createGenericChart(widgetConfig, language, context);
    }

    return widget;
  }

  async createPatientFlowChart(config, language, context) {
    const data = await this.getPatientFlowData(config.timeRange, context);
    
    return {
      type: 'sankey',
      title: this.getLocalizedText(config.title || 'Patient Flow Analysis', language),
      data: {
        nodes: [
          { name: this.getLocalizedText('Registration', language) },
          { name: this.getLocalizedText('Waiting Room', language) },
          { name: this.getLocalizedText('Triage', language) },
          { name: this.getLocalizedText('Consultation', language) },
          { name: this.getLocalizedText('Treatment', language) },
          { name: this.getLocalizedText('Discharge', language) }
        ],
        links: data.flows || [
          { source: 0, target: 1, value: 100 },
          { source: 1, target: 2, value: 95 },
          { source: 2, target: 3, value: 90 },
          { source: 3, target: 4, value: 75 },
          { source: 4, target: 5, value: 70 }
        ]
      },
      options: {
        colors: this.colorPalettes.operational,
        responsive: true,
        rtl: language === 'he'
      }
    };
  }

  async createVitalSignsTimeline(config, language, context) {
    const data = await this.getVitalSignsData(config.patientId, config.timeRange, context);
    
    return {
      type: 'line',
      title: this.getLocalizedText(config.title || 'Vital Signs Timeline', language),
      data: {
        categories: data.timestamps || [],
        series: [
          {
            name: this.getLocalizedText('Heart Rate', language),
            data: data.heartRate || [],
            color: '#E74C3C'
          },
          {
            name: this.getLocalizedText('Blood Pressure', language),
            data: data.bloodPressure || [],
            color: '#3498DB'
          }
        ]
      },
      options: {
        responsive: true,
        rtl: language === 'he'
      }
    };
  }

  async createMedicationAdherenceChart(config, language, context) {
    const data = await this.getMedicationAdherenceData(config.patientId, config.timeRange, context);
    
    return {
      type: 'heatmap',
      title: this.getLocalizedText(config.title || 'Medication Adherence', language),
      data: {
        categories: data.medications || [],
        yCategories: data.days || [],
        data: data.adherenceMatrix || []
      },
      options: {
        responsive: true,
        rtl: language === 'he'
      }
    };
  }

  async createGenericChart(config, language, context) {
    return {
      type: config.type || 'column',
      title: this.getLocalizedText(config.title || 'Chart', language),
      data: {
        categories: [],
        series: []
      },
      options: {
        responsive: true,
        rtl: language === 'he'
      }
    };
  }

  // Helper methods
  getLocalizedText(textKey, language) {
    const translations = {
      en: {
        'Patient Flow Analysis': 'Patient Flow Analysis',
        'Registration': 'Registration',
        'Waiting Room': 'Waiting Room',
        'Triage': 'Triage',
        'Consultation': 'Consultation',
        'Treatment': 'Treatment',
        'Discharge': 'Discharge',
        'Heart Rate': 'Heart Rate',
        'Blood Pressure': 'Blood Pressure',
        'Medication Adherence': 'Medication Adherence'
      },
      he: {
        'Patient Flow Analysis': 'ניתוח זרימת מטופלים',
        'Registration': 'רישום',
        'Waiting Room': 'חדר המתנה',
        'Triage': 'מיון',
        'Consultation': 'יעוץ',
        'Treatment': 'טיפול',
        'Discharge': 'שחרור',
        'Heart Rate': 'קצב לב',
        'Blood Pressure': 'לחץ דם',
        'Medication Adherence': 'היענות לטיפול תרופתי'
      }
    };

    return translations[language]?.[textKey] || textKey;
  }

  generateResponsiveLayout(widgets, layoutType) {
    const layout = {
      desktop: [],
      tablet: [],
      mobile: []
    };

    widgets.forEach((widget, index) => {
      layout.desktop.push({
        i: widget.id,
        x: widget.position.x,
        y: widget.position.y,
        w: widget.position.width,
        h: widget.position.height
      });

      layout.tablet.push({
        i: widget.id,
        x: (widget.position.x * 2) % 6,
        y: Math.floor((widget.position.x * 2) / 6) + widget.position.y,
        w: Math.min(widget.position.width * 2, 6),
        h: widget.position.height
      });

      layout.mobile.push({
        i: widget.id,
        x: 0,
        y: index * 4,
        w: 2,
        h: widget.position.height
      });
    });

    return layout;
  }

  generateRTLStyles(dashboard) {
    return {
      direction: 'rtl',
      textAlign: 'right',
      fontFamily: 'Arial, "Times New Roman", serif'
    };
  }

  startRealtimeDataStreaming() {
    setInterval(async () => {
      for (const [streamId, stream] of this.realtimeStreams.entries()) {
        try {
          const updatedData = await this.fetchRealtimeData(stream.dataSource, stream.context);
          stream.callback(updatedData);
        } catch (error) {
          console.error(`Real-time stream error for ${streamId}:`, error);
        }
      }
    }, 30000); // Update every 30 seconds
  }

  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 1800000; // 30 minutes

      for (const [key, cached] of this.visualizationCache.entries()) {
        if (now - cached.timestamp > maxAge) {
          this.visualizationCache.delete(key);
        }
      }
    }, 600000); // Clean every 10 minutes
  }

  async initializeChartTemplates() {
    // Initialize with basic templates
    console.log('📊 Initializing chart templates');
  }

  async loadDashboardLayouts() {
    // Load saved dashboard layouts
    console.log('📋 Loading dashboard layouts');
  }

  // Data fetching methods (would integrate with actual data sources)
  async getPatientFlowData(timeRange, context) {
    return { flows: [] }; // Placeholder
  }

  async getVitalSignsData(patientId, timeRange, context) {
    return { timestamps: [], heartRate: [], bloodPressure: [] };
  }

  async getMedicationAdherenceData(patientId, timeRange, context) {
    return { medications: [], days: [], adherenceMatrix: [] };
  }

  async fetchRealtimeData(dataSource, context) {
    return {}; // Placeholder
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      chartTypes: Object.keys(this.medicalChartTypes).length,
      colorPalettes: Object.keys(this.colorPalettes).length,
      activeStreams: this.realtimeStreams.size,
      cachedItems: this.visualizationCache.size
    };
  }
}

// Create and export singleton instance
const enhancedDataVisualizationService = new EnhancedDataVisualizationService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('enhancedDataVisualizationService', () => enhancedDataVisualizationService);
}

module.exports = enhancedDataVisualizationService;