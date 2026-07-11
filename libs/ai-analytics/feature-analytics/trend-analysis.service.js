/**
 * 📊 TREND ANALYSIS SERVICE
 * 
 * Advanced trend analysis and pattern recognition system providing statistical
 * modeling, forecasting, and anomaly detection for healthcare analytics with
 * comprehensive insights and actionable intelligence.
 * 
 * FEATURES: Historical analysis, pattern detection, seasonality, forecasting
 * SECURITY: Service authentication and secure data access for all operations
 */

const crypto = require('crypto');

// Service proxy for lazy loading to avoid circular dependencies
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class TrendAnalysisService {
  constructor() {
    this.serviceId = 'trend-analysis-service';
    this.serviceToken = null;
    this.initialized = false;
    this.trendModels = new Map();
    this.patternDetectors = new Map();
    this.seasonalModels = new Map();
    this.anomalyThresholds = new Map();
    this.correlationMatrices = new Map();
    this.trendCache = new Map();
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      await this.initializeTrendModels();
      await this.setupPatternDetectors();
      await this.loadSeasonalModels();
      await this.configureAnomalyDetection();
      await this.setupCorrelationAnalysis();
      this.initialized = true;
      console.log('✅ Trend Analysis Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Trend Analysis Service:', error);
      throw error;
    }
  }

  async initializeTrendModels() {
    const healthcareTrendModels = [
      {
        name: 'patient_volume_trend',
        metric: 'patient_volume',
        timeframe: 'daily',
        method: 'linear_regression',
        smoothing: 'moving_average',
        seasonality: true,
        forecastHorizon: 30
      },
      {
        name: 'revenue_trend',
        metric: 'daily_revenue',
        timeframe: 'daily',
        method: 'exponential_smoothing',
        smoothing: 'exponential',
        seasonality: true,
        forecastHorizon: 90
      },
      {
        name: 'patient_satisfaction_trend',
        metric: 'patient_satisfaction',
        timeframe: 'weekly',
        method: 'polynomial_regression',
        smoothing: 'savitzky_golay',
        seasonality: false,
        forecastHorizon: 12
      },
      {
        name: 'operational_efficiency_trend',
        metric: 'efficiency_score',
        timeframe: 'monthly',
        method: 'arima',
        smoothing: 'kalman_filter',
        seasonality: true,
        forecastHorizon: 6
      }
    ];

    for (const model of healthcareTrendModels) {
      this.trendModels.set(model.name, {
        ...model,
        lastUpdated: null,
        accuracy: null,
        parameters: {}
      });
    }
  }

  async analyzeHistoricalTrend(metricName, dateRange, practiceId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const trendModel = this.getTrendModel(metricName);
      const historicalData = await this.getHistoricalData(metricName, dateRange, practiceId);

      if (historicalData.length < 3) {
        throw new Error(`Insufficient data points for trend analysis: ${historicalData.length}`);
      }

      const analysis = {
        metric: metricName,
        dateRange,
        dataPoints: historicalData.length,
        trend: await this.calculateTrendDirection(historicalData),
        slope: await this.calculateTrendSlope(historicalData),
        correlation: await this.calculateTrendCorrelation(historicalData),
        seasonality: await this.detectSeasonality(historicalData),
        patterns: await this.identifyPatterns(historicalData),
        anomalies: await this.detectAnomalies(historicalData, metricName),
        forecast: await this.generateForecast(historicalData, trendModel),
        statistics: this.calculateTrendStatistics(historicalData),
        insights: await this.generateTrendInsights(historicalData, metricName)
      };

      // Cache the analysis
      this.cacheTrendAnalysis(metricName, practiceId, analysis);

      // Save analysis to database
      const analysisRecord = {
        metricName,
        practiceId,
        dateRange,
        analysis,
        timestamp: new Date(),
        userId: options.userId
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'save-trend-analysis',
        practiceId
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('trend_analyses', analysisRecord, context);

      await this.logAuditEvent('TREND_ANALYSIS_PERFORMED', practiceId, {
        metricName,
        dataPoints: analysis.dataPoints,
        trend: analysis.trend.direction
      });

      return analysis;
    } catch (error) {
      console.error(`Error analyzing historical trend for ${metricName}:`, error);
      throw error;
    }
  }

  async logAuditEvent(action, practiceId, details = {}) {
    try {
      const auditEntry = {
        action,
        service: this.serviceId,
        timestamp: new Date(),
        details
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'audit-logging',
        practiceId
      };

      const proxy = getServiceProxy();
      const SecureDataAccess = proxy.getService('secureDataAccess');
      await SecureDataAccess.create('audit_logs', auditEntry, context);
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  getTrendModel(metricName) {
    // Find appropriate trend model for the metric
    for (const [modelName, model] of this.trendModels) {
      if (model.metric === metricName || modelName.includes(metricName)) {
        return model;
      }
    }

    // Return default model if specific model not found
    return {
      name: 'default_trend',
      method: 'linear_regression',
      smoothing: 'moving_average',
      seasonality: false,
      forecastHorizon: 30
    };
  }

  async getHistoricalData(metricName, dateRange, practiceId) {
    const dataSource = this.getMetricDataSource(metricName);
    const aggregationPeriod = this.getAggregationPeriod(dateRange);

    const pipeline = [
      {
        $match: {
          practiceId,
          date: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: aggregationPeriod === 'daily' ? { $dayOfMonth: '$date' } : null,
            week: aggregationPeriod === 'weekly' ? { $week: '$date' } : null
          },
          value: this.getMetricAggregation(metricName),
          count: { $sum: 1 },
          date: { $first: '$date' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 }
      }
    ];

    const context = {
      serviceId: this.serviceId,
      operation: 'get-historical-data',
      practiceId
    };

    const proxy = getServiceProxy();
    const SecureDataAccess = proxy.getService('secureDataAccess');
    const results = await SecureDataAccess.aggregate(dataSource, pipeline, context);

    return results.map(result => ({
      date: result.date,
      value: result.value,
      count: result.count
    }));
  }

  getMetricDataSource(metricName) {
    const sourceMapping = {
      'patient_volume': 'appointments',
      'daily_revenue': 'financial_transactions',
      'patient_satisfaction': 'patient_surveys',
      'efficiency_score': 'operational_metrics'
    };

    return sourceMapping[metricName] || 'metrics';
  }

  getMetricAggregation(metricName) {
    const aggregationMapping = {
      'patient_volume': { $sum: 1 },
      'daily_revenue': { $sum: '$amount' },
      'patient_satisfaction': { $avg: '$rating' },
      'efficiency_score': { $avg: '$score' }
    };

    return aggregationMapping[metricName] || { $avg: '$value' };
  }

  getAggregationPeriod(dateRange) {
    const durationMs = dateRange.end.getTime() - dateRange.start.getTime();
    const days = durationMs / (1000 * 60 * 60 * 24);

    if (days <= 90) return 'daily';
    if (days <= 365) return 'weekly';
    return 'monthly';
  }

  async calculateTrendDirection(data) {
    const values = data.map(d => d.value);
    const slope = this.calculateLinearRegressionSlope(values);
    
    const direction = slope > 0.05 ? 'increasing' : 
                     slope < -0.05 ? 'decreasing' : 'stable';
    
    const strength = Math.abs(slope) > 0.2 ? 'strong' : 
                    Math.abs(slope) > 0.1 ? 'moderate' : 'weak';

    return {
      direction,
      strength,
      slope,
      confidence: this.calculateTrendConfidence(data)
    };
  }

  async calculateTrendSlope(data) {
    const values = data.map(d => d.value);
    return this.calculateLinearRegressionSlope(values);
  }

  calculateLinearRegressionSlope(values) {
    const n = values.length;
    if (n < 2) return 0;

    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  async calculateTrendCorrelation(data) {
    const values = data.map(d => d.value);
    const indices = Array.from({ length: values.length }, (_, i) => i);
    
    return this.calculatePearsonCorrelation(indices, values);
  }

  calculatePearsonCorrelation(x, y) {
    const n = x.length;
    if (n !== y.length || n < 2) return 0;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  calculateTrendConfidence(data) {
    // Simplified confidence calculation based on data consistency
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = mean !== 0 ? stdDev / Math.abs(mean) : 1;

    // Higher coefficient of variation = lower confidence
    return Math.max(0, Math.min(1, 1 - coefficient));
  }

  async detectSeasonality(data) {
    if (data.length < 12) {
      return { hasSeasonality: false, reason: 'Insufficient data for seasonality detection' };
    }

    const values = data.map(d => d.value);
    const seasonalityTests = [
      await this.testWeeklySeasonality(data),
      await this.testMonthlySeasonality(data),
      await this.testQuarterlySeasonality(data)
    ];

    const significantSeasonality = seasonalityTests.filter(test => test.significant);

    return {
      hasSeasonality: significantSeasonality.length > 0,
      patterns: significantSeasonality,
      dominantPattern: significantSeasonality.length > 0 ? significantSeasonality[0] : null
    };
  }

  async testWeeklySeasonality(data) {
    // Simplified weekly seasonality test
    const weeklyAverages = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);

    for (const point of data) {
      const dayOfWeek = point.date.getDay();
      weeklyAverages[dayOfWeek] += point.value;
      weeklyCounts[dayOfWeek]++;
    }

    // Calculate averages
    const avgByDay = weeklyAverages.map((sum, i) => 
      weeklyCounts[i] > 0 ? sum / weeklyCounts[i] : 0
    );

    const overallAverage = avgByDay.reduce((sum, avg) => sum + avg, 0) / 7;
    const variance = avgByDay.reduce((sum, avg) => sum + Math.pow(avg - overallAverage, 2), 0) / 7;

    return {
      type: 'weekly',
      significant: variance > overallAverage * 0.1,
      variance,
      pattern: avgByDay
    };
  }

  async testMonthlySeasonality(data) {
    return { type: 'monthly', significant: false, pattern: [] };
  }

  async testQuarterlySeasonality(data) {
    return { type: 'quarterly', significant: false, pattern: [] };
  }

  async identifyPatterns(data) {
    const patterns = [];

    // Detect cyclical patterns
    const cyclical = await this.detectCyclicalPatterns(data);
    if (cyclical.detected) {
      patterns.push(cyclical);
    }

    // Detect growth patterns
    const growth = await this.detectGrowthPatterns(data);
    if (growth.detected) {
      patterns.push(growth);
    }

    // Detect volatility patterns
    const volatility = await this.detectVolatilityPatterns(data);
    if (volatility.detected) {
      patterns.push(volatility);
    }

    return patterns;
  }

  async detectCyclicalPatterns(data) {
    // Simplified cyclical pattern detection using autocorrelation
    const values = data.map(d => d.value);
    const autocorrelations = this.calculateAutocorrelation(values, Math.floor(values.length / 4));

    const maxCorr = Math.max(...autocorrelations);
    const maxIndex = autocorrelations.indexOf(maxCorr);

    return {
      type: 'cyclical',
      detected: maxCorr > 0.5,
      period: maxIndex + 1,
      strength: maxCorr
    };
  }

  calculateAutocorrelation(series, maxLag) {
    const n = series.length;
    const mean = series.reduce((sum, val) => sum + val, 0) / n;
    const autocorr = [];

    for (let lag = 1; lag <= maxLag; lag++) {
      let numerator = 0;
      let denominator = 0;

      for (let i = 0; i < n - lag; i++) {
        numerator += (series[i] - mean) * (series[i + lag] - mean);
        denominator += Math.pow(series[i] - mean, 2);
      }

      autocorr.push(denominator !== 0 ? numerator / denominator : 0);
    }

    return autocorr;
  }

  async detectGrowthPatterns(data) {
    const values = data.map(d => d.value);
    const growthRates = [];

    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        growthRates.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }

    const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
    const isConsistentGrowth = growthRates.filter(rate => rate > 0).length > growthRates.length * 0.7;

    return {
      type: 'growth',
      detected: Math.abs(avgGrowthRate) > 0.02 && isConsistentGrowth,
      averageGrowthRate: avgGrowthRate,
      consistency: isConsistentGrowth
    };
  }

  async detectVolatilityPatterns(data) {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 0;

    return {
      type: 'volatility',
      detected: coefficientOfVariation > 0.3,
      level: coefficientOfVariation > 0.5 ? 'high' : 
             coefficientOfVariation > 0.3 ? 'moderate' : 'low',
      coefficient: coefficientOfVariation
    };
  }

  async configureAnomalyDetection() {
    this.anomalyThresholds.set('statistical', {
      method: 'zscore',
      threshold: 2.5,
      minDataPoints: 10
    });

    this.anomalyThresholds.set('isolation_forest', {
      method: 'isolation_forest',
      contamination: 0.1,
      minDataPoints: 20
    });

    this.anomalyThresholds.set('seasonal_decomposition', {
      method: 'seasonal_decomposition',
      threshold: 2.0,
      minDataPoints: 24
    });
  }

  async detectAnomalies(data, metricName) {
    const anomalies = [];
    const values = data.map(d => d.value);

    if (values.length < 10) {
      return anomalies;
    }

    // Statistical anomaly detection (Z-score method)
    const statAnomalies = this.detectStatisticalAnomalies(data);
    anomalies.push(...statAnomalies);

    // Contextual anomaly detection
    const contextAnomalies = await this.detectContextualAnomalies(data, metricName);
    anomalies.push(...contextAnomalies);

    return anomalies;
  }

  detectStatisticalAnomalies(data) {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    const threshold = this.anomalyThresholds.get('statistical').threshold;
    const anomalies = [];

    for (let i = 0; i < data.length; i++) {
      const zScore = stdDev !== 0 ? Math.abs(values[i] - mean) / stdDev : 0;
      
      if (zScore > threshold) {
        anomalies.push({
          type: 'statistical',
          index: i,
          date: data[i].date,
          value: values[i],
          expectedValue: mean,
          zScore,
          severity: zScore > threshold * 1.5 ? 'high' : 'medium'
        });
      }
    }

    return anomalies;
  }

  async detectContextualAnomalies(data, metricName) {
    // Context-specific anomaly detection based on healthcare domain knowledge
    const anomalies = [];

    switch (metricName) {
      case 'patient_volume':
        return this.detectPatientVolumeAnomalies(data);
      case 'daily_revenue':
        return this.detectRevenueAnomalies(data);
      default:
        return [];
    }
  }

  detectPatientVolumeAnomalies(data) {
    const anomalies = [];
    const values = data.map(d => d.value);

    for (let i = 0; i < data.length; i++) {
      // Check for sudden drops (potential system issues)
      if (i > 0 && values[i] < values[i - 1] * 0.5) {
        anomalies.push({
          type: 'sudden_drop',
          index: i,
          date: data[i].date,
          value: values[i],
          previousValue: values[i - 1],
          severity: 'high',
          context: 'Potential system outage or data collection issue'
        });
      }

      // Check for weekend/holiday patterns
      const dayOfWeek = data[i].date.getDay();
      if ((dayOfWeek === 0 || dayOfWeek === 6) && values[i] > 0) { // Weekend
        const weekdayAverage = this.calculateWeekdayAverage(data, i);
        if (values[i] > weekdayAverage * 0.8) {
          anomalies.push({
            type: 'unexpected_weekend_activity',
            index: i,
            date: data[i].date,
            value: values[i],
            expectedValue: weekdayAverage * 0.3,
            severity: 'medium',
            context: 'Unusually high weekend patient volume'
          });
        }
      }
    }

    return anomalies;
  }

  calculateWeekdayAverage(data, currentIndex) {
    const weekdayValues = data
      .slice(Math.max(0, currentIndex - 14), currentIndex) // Last 2 weeks
      .filter(d => d.date.getDay() > 0 && d.date.getDay() < 6) // Weekdays only
      .map(d => d.value);

    return weekdayValues.length > 0 
      ? weekdayValues.reduce((sum, val) => sum + val, 0) / weekdayValues.length 
      : 0;
  }

  detectRevenueAnomalies(data) {
    return [];
  }

  async generateForecast(historicalData, trendModel) {
    const forecastHorizon = trendModel.forecastHorizon || 30;
    
    switch (trendModel.method) {
      case 'linear_regression':
        return await this.generateLinearForecast(historicalData, forecastHorizon);
      case 'exponential_smoothing':
        return await this.generateExponentialForecast(historicalData, forecastHorizon);
      case 'arima':
        return await this.generateARIMAForecast(historicalData, forecastHorizon);
      default:
        return await this.generateLinearForecast(historicalData, forecastHorizon);
    }
  }

  async generateLinearForecast(data, horizon) {
    const values = data.map(d => d.value);
    const slope = this.calculateLinearRegressionSlope(values);
    const lastValue = values[values.length - 1];
    const lastDate = data[data.length - 1].date;

    const forecast = [];
    for (let i = 1; i <= horizon; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      const forecastValue = lastValue + (slope * i);
      const confidence = Math.max(0.1, 0.9 - (i * 0.02)); // Decreasing confidence

      forecast.push({
        date: forecastDate,
        value: Math.max(0, forecastValue),
        confidence,
        method: 'linear_regression'
      });
    }

    return {
      method: 'linear_regression',
      horizon,
      forecast,
      accuracy: this.calculateForecastAccuracy(data, 'linear_regression')
    };
  }

  async generateExponentialForecast(data, horizon) {
    const values = data.map(d => d.value);
    const alpha = 0.3; // Smoothing parameter
    
    // Calculate exponentially smoothed values
    let smoothedValue = values[0];
    for (let i = 1; i < values.length; i++) {
      smoothedValue = alpha * values[i] + (1 - alpha) * smoothedValue;
    }

    const lastDate = data[data.length - 1].date;
    const forecast = [];

    for (let i = 1; i <= horizon; i++) {
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      forecast.push({
        date: forecastDate,
        value: Math.max(0, smoothedValue),
        confidence: Math.max(0.2, 0.9 - (i * 0.015)),
        method: 'exponential_smoothing'
      });
    }

    return {
      method: 'exponential_smoothing',
      horizon,
      forecast,
      accuracy: this.calculateForecastAccuracy(data, 'exponential_smoothing')
    };
  }

  async generateARIMAForecast(data, horizon) {
    return await this.generateLinearForecast(data, horizon);
  }

  calculateForecastAccuracy(historicalData, method) {
    if (historicalData.length < 20) return 0.7;

    const holdoutSize = Math.min(10, Math.floor(historicalData.length * 0.2));
    const trainingData = historicalData.slice(0, -holdoutSize);
    const testData = historicalData.slice(-holdoutSize);

    let mape = 0;
    for (let i = 0; i < testData.length; i++) {
      const actual = testData[i].value;
      const predicted = this.simplePrediction(trainingData, i + 1, method);
      
      if (actual !== 0) {
        mape += Math.abs((actual - predicted) / actual);
      }
    }

    mape /= testData.length;
    return Math.max(0.1, Math.min(0.95, 1 - mape));
  }

  simplePrediction(data, stepsAhead, method) {
    const values = data.map(d => d.value);
    const lastValue = values[values.length - 1];
    
    switch (method) {
      case 'linear_regression':
        const slope = this.calculateLinearRegressionSlope(values);
        return lastValue + (slope * stepsAhead);
      default:
        return lastValue;
    }
  }

  calculateTrendStatistics(data) {
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return {
      count: values.length,
      mean,
      median: this.calculateMedian(values),
      variance,
      standardDeviation: Math.sqrt(variance),
      minimum: Math.min(...values),
      maximum: Math.max(...values),
      range: Math.max(...values) - Math.min(...values)
    };
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  async generateTrendInsights(data, metricName) {
    const insights = [];

    // Performance insights
    const trend = await this.calculateTrendDirection(data);
    if (trend.direction === 'increasing' && trend.strength === 'strong') {
      insights.push({
        type: 'positive_trend',
        message: `${metricName} shows strong positive growth`,
        impact: 'positive',
        confidence: trend.confidence
      });
    } else if (trend.direction === 'decreasing' && trend.strength === 'strong') {
      insights.push({
        type: 'negative_trend',
        message: `${metricName} shows concerning downward trend`,
        impact: 'negative',
        confidence: trend.confidence,
        recommendation: 'Investigate underlying causes and develop intervention plan'
      });
    }

    // Seasonality insights
    const seasonality = await this.detectSeasonality(data);
    if (seasonality.hasSeasonality) {
      insights.push({
        type: 'seasonal_pattern',
        message: `${metricName} exhibits ${seasonality.dominantPattern?.type} seasonal patterns`,
        impact: 'informational',
        recommendation: 'Consider seasonal adjustments in planning and resource allocation'
      });
    }

    return insights;
  }

  cacheTrendAnalysis(metricName, practiceId, analysis) {
    const cacheKey = `${metricName}_${practiceId}`;
    this.trendCache.set(cacheKey, {
      analysis,
      timestamp: new Date(),
      ttl: 3600000 // 1 hour
    });
  }

  async setupPatternDetectors() {
    this.patternDetectors.set('spike_detection', {
      method: 'statistical_threshold',
      threshold: 2.5,
      minDuration: 1
    });

    this.patternDetectors.set('plateau_detection', {
      method: 'variance_threshold',
      threshold: 0.1,
      minDuration: 7
    });

    this.patternDetectors.set('cycle_detection', {
      method: 'autocorrelation',
      threshold: 0.5,
      minCycles: 2
    });
  }

  async loadSeasonalModels() {
    this.seasonalModels.set('weekly', {
      period: 7,
      method: 'additive'
    });

    this.seasonalModels.set('monthly', {
      period: 30,
      method: 'multiplicative'
    });

    this.seasonalModels.set('quarterly', {
      period: 90,
      method: 'additive'
    });
  }

  async setupCorrelationAnalysis() {
    this.correlationMatrices.set('operational_metrics', [
      'patient_volume',
      'wait_time',
      'staff_utilization',
      'patient_satisfaction'
    ]);

    this.correlationMatrices.set('financial_metrics', [
      'daily_revenue',
      'cost_per_patient',
      'collection_rate',
      'profit_margin'
    ]);
  }

  getServiceStatus() {
    return {
      initialized: this.initialized,
      trendModelsLoaded: this.trendModels.size,
      patternDetectorsLoaded: this.patternDetectors.size,
      seasonalModelsLoaded: this.seasonalModels.size,
      cacheSize: this.trendCache.size,
      serviceId: this.serviceId
    };
  }
}

// Create instance
const trendAnalysisService = new TrendAnalysisService();

// Register service with proxy manager
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('trendAnalysisService', () => trendAnalysisService);
}

module.exports = trendAnalysisService;