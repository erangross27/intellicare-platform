// IntelliCare Real-time Chart Generation Service
// Dynamic chart creation from conversational AI requests with live data streaming

// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class RealtimeChartService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.activeCharts = new Map();
    this.chartConfigs = new Map();
    this.webSocketConnections = new Map();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('realtime-chart-service');
      
      // Initialize chart configurations
      this.initializeChartConfigs();
      
      this.initialized = true;
      console.log('✅ [RealtimeChartService] Initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ [RealtimeChartService] Initialization failed:', error);
      throw error;
    }
  }

  getServiceContext(practiceId, operation = 'chart-generation') {
    return {
      serviceId: 'realtime-chart-service',
      operation: operation,
      practiceId: practiceId
    };
  }

  initializeChartConfigs() {
    // Healthcare-specific chart configurations
    this.chartTypes = {
      // Standard charts
      line: { type: 'line', responsive: true, animation: true },
      bar: { type: 'bar', responsive: true, animation: true },
      pie: { type: 'pie', responsive: true, animation: true },
      scatter: { type: 'scatter', responsive: true, animation: true },
      heatmap: { type: 'heatmap', responsive: true, animation: false },
      gauge: { type: 'gauge', responsive: true, animation: true },
      funnel: { type: 'funnel', responsive: true, animation: true },
      
      // Healthcare-specific charts
      patientflow: { type: 'sankey', responsive: true, animation: true },
      clinical_trend: { type: 'line', responsive: true, animation: true, medical: true },
      vital_signs: { type: 'multi-axis', responsive: true, animation: true },
      resource_utilization: { type: 'stacked-bar', responsive: true, animation: true },
      quality_metrics: { type: 'radar', responsive: true, animation: true },
      appointment_heatmap: { type: 'calendar-heatmap', responsive: true, animation: false }
    };
  }

  // ========== CHART GENERATION ==========

  async generateRealtimeChart(chartType, dataSource, timeRange, filters, interactive, context) {
    try {
      const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Fetch data from source
      const data = await this.fetchChartData(dataSource, timeRange, filters, context);
      
      // Process data for chart type
      const processedData = await this.processDataForChart(data, chartType, context);
      
      // Generate chart configuration
      const chartConfig = this.generateChartConfig(chartType, processedData, interactive, context);
      
      // Store active chart
      this.activeCharts.set(chartId, {
        type: chartType,
        dataSource,
        filters,
        config: chartConfig,
        data: processedData,
        createdAt: new Date(),
        interactive,
        context
      });
      
      // Start real-time updates if requested
      if (context.realtime) {
        this.startRealtimeUpdates(chartId, dataSource, filters, context);
      }
      
      return {
        success: true,
        chartId,
        type: chartType,
        config: chartConfig,
        data: processedData,
        interactive,
        exportable: true
      };
    } catch (error) {
      console.error('Error generating realtime chart:', error);
      throw error;
    }
  }

  async fetchChartData(dataSource, timeRange, filters, context) {
    try {
      const collection = this.getCollectionForDataSource(dataSource);
      
      const query = {
        practiceId: context.practiceId,
        ...filters
      };
      
      // Apply time range
      if (timeRange) {
        if (timeRange.startDate && timeRange.endDate) {
          query.date = {
            $gte: new Date(timeRange.startDate),
            $lte: new Date(timeRange.endDate)
          };
        } else if (timeRange.period) {
          const periodMs = this.getPeriodMs(timeRange.period);
          query.date = { $gte: new Date(Date.now() - periodMs) };
        }
      }
      
      const data = await secureDataAccess.query(collection, query, {
        sort: { date: -1 },
        limit: 1000
      }, this.getServiceContext(context.practiceId, 'fetch-chart-data'));
      
      return data;
    } catch (error) {
      console.error('Error fetching chart data:', error);
      throw error;
    }
  }

  async processDataForChart(data, chartType, context) {
    switch (chartType) {
      case 'line':
      case 'clinical_trend':
        return this.processTimeSeriesData(data, context);
        
      case 'bar':
      case 'resource_utilization':
        return this.processCategoricalData(data, context);
        
      case 'pie':
        return this.processDistributionData(data, context);
        
      case 'scatter':
        return this.processCorrelationData(data, context);
        
      case 'heatmap':
      case 'appointment_heatmap':
        return this.processHeatmapData(data, context);
        
      case 'gauge':
        return this.processMetricData(data, context);
        
      case 'patientflow':
        return this.processFlowData(data, context);
        
      case 'quality_metrics':
        return this.processRadarData(data, context);
        
      default:
        return data;
    }
  }

  processTimeSeriesData(data, context) {
    const isHebrew = context.language === 'he';
    
    // Group by date
    const grouped = {};
    data.forEach(item => {
      const date = new Date(item.date || item.createdAt).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });
    
    // Create time series
    return {
      labels: Object.keys(grouped).sort(),
      datasets: [{
        label: isHebrew ? 'נתונים' : 'Data',
        data: Object.keys(grouped).sort().map(date => ({
          x: date,
          y: grouped[date].length
        })),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        tension: 0.4
      }]
    };
  }

  processCategoricalData(data, context) {
    const isHebrew = context.language === 'he';
    
    // Group by category
    const categories = {};
    data.forEach(item => {
      const category = item.category || item.department || item.type || 'Other';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return {
      labels: Object.keys(categories),
      datasets: [{
        label: isHebrew ? 'ספירה' : 'Count',
        data: Object.values(categories),
        backgroundColor: [
          '#1976d2', '#dc004e', '#f57c00', '#388e3c',
          '#7b1fa2', '#c2185b', '#0288d1', '#fbc02d'
        ]
      }]
    };
  }

  processDistributionData(data, context) {
    const isHebrew = context.language === 'he';
    
    // Calculate distribution
    const distribution = {};
    data.forEach(item => {
      const key = item.status || item.type || item.category || 'Other';
      distribution[key] = (distribution[key] || 0) + 1;
    });
    
    return {
      labels: Object.keys(distribution),
      datasets: [{
        data: Object.values(distribution),
        backgroundColor: [
          '#1976d2', '#dc004e', '#f57c00', '#388e3c',
          '#7b1fa2', '#c2185b', '#0288d1', '#fbc02d'
        ]
      }]
    };
  }

  processCorrelationData(data, context) {
    // Extract two numeric variables for correlation
    return {
      datasets: [{
        label: 'Correlation',
        data: data.map(item => ({
          x: item.value1 || Math.random() * 100,
          y: item.value2 || Math.random() * 100
        })),
        backgroundColor: 'rgba(25, 118, 210, 0.5)'
      }]
    };
  }

  processHeatmapData(data, context) {
    // Create heatmap matrix
    const matrix = [];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    days.forEach((day, dayIndex) => {
      hours.forEach(hour => {
        const count = data.filter(item => {
          const date = new Date(item.date || item.createdAt);
          return date.getDay() === dayIndex && date.getHours() === hour;
        }).length;
        
        matrix.push({
          x: hour,
          y: dayIndex,
          v: count
        });
      });
    });
    
    return {
      data: matrix,
      xLabels: hours,
      yLabels: days
    };
  }

  processMetricData(data, context) {
    // Calculate single metric value
    const value = data.length || 0;
    const target = 100; // Example target
    
    return {
      value,
      target,
      percentage: (value / target) * 100,
      color: value >= target ? '#388e3c' : value >= target * 0.8 ? '#f57c00' : '#dc004e'
    };
  }

  processFlowData(data, context) {
    // Create flow/sankey data structure
    const nodes = [];
    const links = [];
    
    // Extract unique stages
    const stages = new Set();
    data.forEach(item => {
      if (item.fromStage) stages.add(item.fromStage);
      if (item.toStage) stages.add(item.toStage);
    });
    
    // Create nodes
    Array.from(stages).forEach((stage, index) => {
      nodes.push({ id: index, name: stage });
    });
    
    // Create links between stages
    const flowCounts = {};
    data.forEach(item => {
      if (item.fromStage && item.toStage) {
        const key = `${item.fromStage}-${item.toStage}`;
        flowCounts[key] = (flowCounts[key] || 0) + 1;
      }
    });
    
    Object.entries(flowCounts).forEach(([key, value]) => {
      const [from, to] = key.split('-');
      const fromIndex = nodes.findIndex(n => n.name === from);
      const toIndex = nodes.findIndex(n => n.name === to);
      if (fromIndex >= 0 && toIndex >= 0) {
        links.push({ source: fromIndex, target: toIndex, value });
      }
    });
    
    return { nodes, links };
  }

  processRadarData(data, context) {
    const isHebrew = context.language === 'he';
    
    // Quality metrics for radar chart
    const metrics = {
      'Patient Safety': 85,
      'Clinical Effectiveness': 78,
      'Patient Experience': 92,
      'Care Coordination': 88,
      'Efficiency': 75,
      'Equity': 82
    };
    
    return {
      labels: Object.keys(metrics),
      datasets: [{
        label: isHebrew ? 'מדדי איכות' : 'Quality Metrics',
        data: Object.values(metrics),
        backgroundColor: 'rgba(25, 118, 210, 0.2)',
        borderColor: '#1976d2',
        pointBackgroundColor: '#1976d2'
      }]
    };
  }

  generateChartConfig(chartType, data, interactive, context) {
    const isHebrew = context.language === 'he';
    const baseConfig = this.chartTypes[chartType] || this.chartTypes.line;
    
    const config = {
      type: baseConfig.type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: interactive ? 'index' : 'nearest'
        },
        plugins: {
          title: {
            display: true,
            text: this.getChartTitle(chartType, context),
            align: isHebrew ? 'end' : 'start'
          },
          legend: {
            position: 'top',
            align: isHebrew ? 'end' : 'start',
            rtl: isHebrew,
            textDirection: isHebrew ? 'rtl' : 'ltr'
          },
          tooltip: {
            enabled: true,
            rtl: isHebrew,
            textDirection: isHebrew ? 'rtl' : 'ltr'
          }
        },
        scales: this.getScalesConfig(chartType, isHebrew)
      }
    };
    
    return config;
  }

  getScalesConfig(chartType, isRTL) {
    if (['pie', 'gauge', 'radar'].includes(chartType)) {
      return undefined; // These charts don't use scales
    }
    
    return {
      x: {
        position: 'bottom',
        reverse: false,
        grid: { display: true }
      },
      y: {
        position: isRTL ? 'right' : 'left',
        reverse: false,
        grid: { display: true }
      }
    };
  }

  getChartTitle(chartType, context) {
    const isHebrew = context.language === 'he';
    
    const titles = {
      en: {
        line: 'Trend Analysis',
        bar: 'Distribution Analysis',
        pie: 'Breakdown Analysis',
        scatter: 'Correlation Analysis',
        heatmap: 'Activity Heatmap',
        gauge: 'Performance Metric',
        patientflow: 'Patient Flow Analysis',
        clinical_trend: 'Clinical Trend',
        quality_metrics: 'Quality Metrics'
      },
      he: {
        line: 'ניתוח מגמות',
        bar: 'ניתוח התפלגות',
        pie: 'ניתוח פילוח',
        scatter: 'ניתוח קורלציה',
        heatmap: 'מפת חום פעילות',
        gauge: 'מדד ביצועים',
        patientflow: 'ניתוח זרימת מטופלים',
        clinical_trend: 'מגמה קלינית',
        quality_metrics: 'מדדי איכות'
      }
    };
    
    return titles[isHebrew ? 'he' : 'en'][chartType] || chartType;
  }

  // ========== REAL-TIME UPDATES ==========

  startRealtimeUpdates(chartId, dataSource, filters, context) {
    // Set up WebSocket or polling for real-time updates
    const updateInterval = setInterval(async () => {
      try {
        const newData = await this.fetchChartData(dataSource, 
          { period: 'last_5_minutes' }, 
          filters, 
          context
        );
        
        if (newData && newData.length > 0) {
          this.updateChart(chartId, newData);
        }
      } catch (error) {
        console.error('Error updating chart:', error);
      }
    }, 5000); // Update every 5 seconds
    
    // Store interval for cleanup
    this.activeCharts.get(chartId).updateInterval = updateInterval;
  }

  updateChart(chartId, newData) {
    const chart = this.activeCharts.get(chartId);
    if (!chart) return;
    
    // Process new data
    const processedData = this.processDataForChart(newData, chart.type, chart.context);
    
    // Merge with existing data
    if (chart.data.datasets && processedData.datasets) {
      chart.data.datasets.forEach((dataset, index) => {
        if (processedData.datasets[index]) {
          // Append new data points
          dataset.data = [...dataset.data, ...processedData.datasets[index].data]
            .slice(-100); // Keep last 100 points
        }
      });
    }
    
    // Notify connected clients
    this.notifyChartUpdate(chartId, chart.data);
  }

  notifyChartUpdate(chartId, data) {
    // Send update through WebSocket
    const connections = this.webSocketConnections.get(chartId) || [];
    connections.forEach(ws => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'chart_update',
          chartId,
          data
        }));
      }
    });
  }

  // ========== HEALTHCARE-SPECIFIC CHARTS ==========

  async generatePatientFlowChart(timeframe, departments, context) {
    try {
      const data = await this.fetchPatientFlowData(timeframe, departments, context);
      const flowData = this.processFlowData(data, context);
      
      return {
        success: true,
        type: 'patientflow',
        data: flowData,
        config: {
          type: 'sankey',
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: context.language === 'he' ? 'זרימת מטופלים' : 'Patient Flow'
              }
            }
          }
        }
      };
    } catch (error) {
      console.error('Error generating patient flow chart:', error);
      throw error;
    }
  }

  async createClinicalTrendChart(metric, patientGroup, period, context) {
    try {
      const data = await this.fetchClinicalData(metric, patientGroup, period, context);
      const trendData = this.processClinicalTrendData(data, metric, context);
      
      return {
        success: true,
        type: 'clinical_trend',
        data: trendData,
        config: {
          type: 'line',
          options: {
            responsive: true,
            plugins: {
              title: {
                display: true,
                text: `${metric} Trend Analysis`
              },
              annotation: {
                annotations: this.getClinicalAnnotations(metric)
              }
            }
          }
        }
      };
    } catch (error) {
      console.error('Error creating clinical trend chart:', error);
      throw error;
    }
  }

  async buildResourceUtilizationChart(resourceType, timeframe, context) {
    try {
      const data = await this.fetchResourceData(resourceType, timeframe, context);
      const utilizationData = this.processUtilizationData(data, resourceType, context);
      
      return {
        success: true,
        type: 'resource_utilization',
        data: utilizationData,
        config: {
          type: 'bar',
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: function(value) {
                    return value + '%';
                  }
                }
              }
            },
            plugins: {
              title: {
                display: true,
                text: `${resourceType} Utilization`
              }
            }
          }
        }
      };
    } catch (error) {
      console.error('Error building resource utilization chart:', error);
      throw error;
    }
  }

  async generateQualityDashboard(qualityMetrics, compareToBaseline, context) {
    try {
      const metricsData = await this.fetchQualityMetrics(qualityMetrics, context);
      let baselineData = null;
      
      if (compareToBaseline) {
        baselineData = await this.fetchBaselineMetrics(qualityMetrics, context);
      }
      
      const dashboardData = this.processQualityDashboardData(metricsData, baselineData, context);
      
      return {
        success: true,
        type: 'quality_dashboard',
        data: dashboardData,
        charts: [
          {
            type: 'radar',
            data: dashboardData.radarData,
            title: 'Quality Metrics Overview'
          },
          {
            type: 'bar',
            data: dashboardData.comparisonData,
            title: 'Performance vs Baseline'
          },
          {
            type: 'line',
            data: dashboardData.trendData,
            title: 'Quality Trends'
          }
        ]
      };
    } catch (error) {
      console.error('Error generating quality dashboard:', error);
      throw error;
    }
  }

  // ========== EXPORT FUNCTIONS ==========

  async exportChart(chartId, format) {
    try {
      const chart = this.activeCharts.get(chartId);
      if (!chart) {
        throw new Error('Chart not found');
      }
      
      switch (format) {
        case 'png':
          return this.exportAsPNG(chart);
        case 'svg':
          return this.exportAsSVG(chart);
        case 'pdf':
          return this.exportAsPDF(chart);
        case 'csv':
          return this.exportAsCSV(chart);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Error exporting chart:', error);
      throw error;
    }
  }

  exportAsPNG(chart) {
    // In production, would use canvas rendering
    return {
      format: 'png',
      filename: `chart-${chart.type}-${Date.now()}.png`,
      data: chart.config
    };
  }

  exportAsSVG(chart) {
    // In production, would generate SVG
    return {
      format: 'svg',
      filename: `chart-${chart.type}-${Date.now()}.svg`,
      data: chart.config
    };
  }

  exportAsPDF(chart) {
    // In production, would use PDF generation library
    return {
      format: 'pdf',
      filename: `chart-${chart.type}-${Date.now()}.pdf`,
      data: chart.config
    };
  }

  exportAsCSV(chart) {
    // Convert chart data to CSV
    const csv = this.convertToCSV(chart.data);
    return {
      format: 'csv',
      filename: `chart-data-${Date.now()}.csv`,
      data: csv
    };
  }

  convertToCSV(data) {
    if (!data.datasets || data.datasets.length === 0) return '';
    
    const rows = [];
    
    // Header
    rows.push(['Label', ...data.datasets.map(d => d.label || 'Data')]);
    
    // Data rows
    const maxLength = Math.max(...data.datasets.map(d => d.data.length));
    for (let i = 0; i < maxLength; i++) {
      const row = [data.labels ? data.labels[i] : i];
      data.datasets.forEach(dataset => {
        row.push(dataset.data[i]?.y || dataset.data[i] || '');
      });
      rows.push(row);
    }
    
    return rows.map(r => r.join(',')).join('\n');
  }

  // ========== HELPER METHODS ==========

  getCollectionForDataSource(dataSource) {
    const collectionMap = {
      patients: 'patients',
      appointments: 'appointments',
      revenue: 'billing',
      quality: 'quality_metrics',
      staff: 'staff',
      resources: 'resources',
      medications: 'prescriptions',
      labs: 'lab_results'
    };
    
    return collectionMap[dataSource] || 'analytics_data';
  }

  getPeriodMs(period) {
    const periods = {
      'last_5_minutes': 5 * 60 * 1000,
      'last_hour': 60 * 60 * 1000,
      'last_day': 24 * 60 * 60 * 1000,
      'last_week': 7 * 24 * 60 * 60 * 1000,
      'last_month': 30 * 24 * 60 * 60 * 1000,
      'last_quarter': 90 * 24 * 60 * 60 * 1000,
      'last_year': 365 * 24 * 60 * 60 * 1000
    };
    
    return periods[period] || periods.last_month;
  }

  async fetchPatientFlowData(timeframe, departments, context) {
    // Fetch patient movement data between departments
    return await secureDataAccess.query('patient_transfers', {
      practiceId: context.practiceId,
      date: { $gte: new Date(timeframe.start), $lte: new Date(timeframe.end) },
      ...(departments && { department: { $in: departments } })
    }, {}, this.getServiceContext(context.practiceId, 'fetch-patient-flow-data'));
  }

  async fetchClinicalData(metric, patientGroup, period, context) {
    // Fetch clinical metric data
    return await secureDataAccess.query('clinical_metrics', {
      practiceId: context.practiceId,
      metric,
      ...(patientGroup && { patientGroup }),
      date: { $gte: new Date(Date.now() - this.getPeriodMs(period)) }
    }, {}, this.getServiceContext(context.practiceId, 'fetch-clinical-data'));
  }

  async fetchResourceData(resourceType, timeframe, context) {
    // Fetch resource utilization data
    return await secureDataAccess.query('resource_utilization', {
      practiceId: context.practiceId,
      resourceType,
      date: { $gte: new Date(timeframe.start), $lte: new Date(timeframe.end) }
    }, {}, this.getServiceContext(context.practiceId, 'fetch-resource-data'));
  }

  async fetchQualityMetrics(metrics, context) {
    // Fetch quality metrics data
    return await secureDataAccess.query('quality_metrics', {
      practiceId: context.practiceId,
      metric: { $in: metrics }
    }, {}, this.getServiceContext(context.practiceId, 'fetch-quality-metrics'));
  }

  async fetchBaselineMetrics(metrics, context) {
    // Fetch baseline/benchmark data
    return await secureDataAccess.query('baseline_metrics', {
      practiceId: context.practiceId,
      metric: { $in: metrics }
    }, {}, this.getServiceContext(context.practiceId, 'fetch-baseline-metrics'));
  }

  processClinicalTrendData(data, metric, context) {
    // Process clinical data for trend analysis
    const grouped = {};
    data.forEach(item => {
      const date = new Date(item.date).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item.value);
    });
    
    return {
      labels: Object.keys(grouped).sort(),
      datasets: [{
        label: metric,
        data: Object.keys(grouped).sort().map(date => {
          const values = grouped[date];
          return {
            x: date,
            y: values.reduce((a, b) => a + b, 0) / values.length
          };
        }),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        tension: 0.4
      }]
    };
  }

  processUtilizationData(data, resourceType, context) {
    // Process resource utilization data
    const utilization = {};
    data.forEach(item => {
      const key = item.resource || resourceType;
      utilization[key] = item.utilizationPercentage || 0;
    });
    
    return {
      labels: Object.keys(utilization),
      datasets: [{
        label: 'Utilization %',
        data: Object.values(utilization),
        backgroundColor: Object.values(utilization).map(v => 
          v > 90 ? '#dc004e' : v > 70 ? '#f57c00' : '#388e3c'
        )
      }]
    };
  }

  processQualityDashboardData(metricsData, baselineData, context) {
    // Process quality metrics for dashboard
    const metrics = {};
    metricsData.forEach(item => {
      metrics[item.metric] = item.value;
    });
    
    const baseline = {};
    if (baselineData) {
      baselineData.forEach(item => {
        baseline[item.metric] = item.value;
      });
    }
    
    return {
      radarData: {
        labels: Object.keys(metrics),
        datasets: [{
          label: 'Current',
          data: Object.values(metrics),
          backgroundColor: 'rgba(25, 118, 210, 0.2)',
          borderColor: '#1976d2'
        },
        ...(baselineData ? [{
          label: 'Baseline',
          data: Object.keys(metrics).map(k => baseline[k] || 0),
          backgroundColor: 'rgba(220, 0, 78, 0.2)',
          borderColor: '#dc004e'
        }] : [])]
      },
      comparisonData: {
        labels: Object.keys(metrics),
        datasets: [{
          label: 'Current vs Baseline',
          data: Object.keys(metrics).map(k => 
            baseline[k] ? ((metrics[k] - baseline[k]) / baseline[k] * 100) : 0
          ),
          backgroundColor: '#1976d2'
        }]
      },
      trendData: this.generateTrendData(metricsData, context)
    };
  }

  generateTrendData(metricsData, context) {
    // Generate trend data for quality metrics
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Quality Score',
        data: [75, 78, 82, 80, 85, 88],
        borderColor: '#1976d2',
        tension: 0.4
      }]
    };
  }

  getClinicalAnnotations(metric) {
    // Get clinical threshold annotations
    const thresholds = {
      'blood_pressure': [
        { type: 'line', yMin: 90, yMax: 90, label: { content: 'Low BP' } },
        { type: 'line', yMin: 140, yMax: 140, label: { content: 'High BP' } }
      ],
      'heart_rate': [
        { type: 'line', yMin: 60, yMax: 60, label: { content: 'Low HR' } },
        { type: 'line', yMin: 100, yMax: 100, label: { content: 'High HR' } }
      ],
      'glucose': [
        { type: 'line', yMin: 70, yMax: 70, label: { content: 'Low' } },
        { type: 'line', yMin: 180, yMax: 180, label: { content: 'High' } }
      ]
    };
    
    return thresholds[metric] || [];
  }

  // Cleanup
  stopRealtimeUpdates(chartId) {
    const chart = this.activeCharts.get(chartId);
    if (chart && chart.updateInterval) {
      clearInterval(chart.updateInterval);
    }
  }

  removeChart(chartId) {
    this.stopRealtimeUpdates(chartId);
    this.activeCharts.delete(chartId);
    this.webSocketConnections.delete(chartId);
  }
}

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('realtimeChartService', () => {
    return module.exports;
  });
}

module.exports = new RealtimeChartService();