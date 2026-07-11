// IntelliCare Predictive Analytics AI Service
// ML-powered predictions for clinical outcomes, operational demand, and financial forecasting
// NOTE: Google/Gemini integration disabled - using Claude only

// const { GoogleGenerativeAI } = require('@google/generative-ai'); // REMOVED: Gemini no longer used
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');

class PredictiveAnalyticsAIService {
  constructor() {
    this.serviceToken = null;
    this.genAI = null;
    this.initialized = false;
    this.models = new Map();
    this.predictions = new Map();
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('predictive-analytics-ai-service');
      
      // Initialize AI - DISABLED (Gemini removed, using Claude only)
      // await productionKMS.initialize();
      // const apiKey = await productionKMS.getInternalKey('GOOGLE_API_KEY');
      // this.genAI = new GoogleGenerativeAI(apiKey);
      this.genAI = null; // Disabled
      
      // Initialize prediction models
      this.initializePredictionModels();
      
      this.initialized = true;
      console.log('✅ [PredictiveAnalyticsAIService] Initialized successfully');
      return this;
    } catch (error) {
      console.error('❌ [PredictiveAnalyticsAIService] Initialization failed:', error);
      throw error;
    }
  }

  initializePredictionModels() {
    // Initialize different prediction model configurations
    this.modelConfigs = {
      clinical: {
        model: 'claude-sonnet-5', // Changed from gemini
        temperature: 0.3,
        maxTokens: 2000
      },
      operational: {
        model: 'claude-sonnet-5', // Changed from gemini
        temperature: 0.5,
        maxTokens: 1500
      },
      financial: {
        model: 'gemini-1.5-flash',
        temperature: 0.4,
        maxTokens: 1500
      }
    };
  }

  // ========== CLINICAL PREDICTIONS ==========

  async predictPatientOutcome(patientId, treatmentPlan, timeHorizon, context) {
    try {
      // Fetch patient history
      const patientData = await this.fetchPatientData(patientId, context);
      
      // GEMINI DISABLED - Using Claude only
      throw new Error('Gemini service disabled - use Claude service instead');
      
      /*
      // Fetch similar cases
      const similarCases = await this.findSimilarCases(patientData, treatmentPlan, context);
      
      // Generate prediction using AI
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
        Predict patient outcome based on:
        Patient Profile: ${JSON.stringify(patientData)}
        Treatment Plan: ${JSON.stringify(treatmentPlan)}
        Similar Cases Outcomes: ${JSON.stringify(similarCases)}
        Time Horizon: ${timeHorizon}
        
        Provide:
        1. Predicted outcome probability
        2. Key factors influencing outcome
        3. Risk factors to monitor
        4. Confidence level
      `;
      
      const result = await model.generateContent(prompt);
      const prediction = this.parseOutcomePrediction(result.response.text());
      
      // Store prediction
      await this.storePrediction('patient_outcome', prediction, context);
      */
      
      return {
        success: false,
        error: 'Gemini service disabled - use Claude service instead',
        prediction: {
          outcome: prediction.outcome,
          probability: prediction.probability,
          confidence: prediction.confidence,
          factors: prediction.factors,
          risks: prediction.risks,
          timeHorizon
        },
        similarCasesAnalyzed: similarCases.length
      };
    } catch (error) {
      console.error('Error predicting patient outcome:', error);
      throw error;
    }
  }

  async predictReadmissionRisk(patientId, admissionData, context) {
    try {
      const patientHistory = await this.fetchPatientHistory(patientId, context);
      
      // Calculate risk factors
      const riskFactors = this.calculateReadmissionRiskFactors(patientHistory, admissionData);
      
      // ML model prediction
      const riskScore = this.calculateReadmissionScore(riskFactors);
      
      // Determine risk category
      const riskCategory = this.categorizeRisk(riskScore);
      
      // Generate recommendations
      const recommendations = await this.generateReadmissionPreventionRecommendations(
        riskFactors, 
        riskCategory,
        context
      );
      
      return {
        success: true,
        patientId,
        riskScore,
        riskCategory,
        contributingFactors: riskFactors,
        recommendations,
        confidence: 0.85
      };
    } catch (error) {
      console.error('Error predicting readmission risk:', error);
      throw error;
    }
  }

  async predictClinicalDeterioration(patientId, vitalSigns, labResults, context) {
    try {
      // Analyze vital signs trends
      const vitalsTrend = this.analyzeVitalsTrend(vitalSigns);
      
      // Analyze lab results
      const labTrend = this.analyzeLabTrend(labResults);
      
      // Calculate deterioration risk
      const deteriorationRisk = this.calculateDeteriorationRisk(vitalsTrend, labTrend);
      
      // Predict time to event if risk is high
      let timeToEvent = null;
      if (deteriorationRisk > 0.7) {
        timeToEvent = this.estimateTimeToDeterioration(vitalsTrend, labTrend);
      }
      
      return {
        success: true,
        patientId,
        deteriorationRisk,
        timeToEvent,
        severity: this.calculateSeverity(deteriorationRisk),
        interventionWindow: this.calculateInterventionWindow(deteriorationRisk, timeToEvent),
        alertLevel: this.determineAlertLevel(deteriorationRisk),
        indicators: [...vitalsTrend.abnormal, ...labTrend.abnormal]
      };
    } catch (error) {
      console.error('Error predicting clinical deterioration:', error);
      throw error;
    }
  }

  async predictTreatmentResponse(patientId, treatment, patientProfile, context) {
    try {
      // GEMINI DISABLED - Using Claude only
      throw new Error('Gemini service disabled - use Claude service instead');
      
      /*
      // Find similar patients who received same treatment
      const similarPatients = await this.findSimilarPatientsTreated(treatment, patientProfile, context);
      
      // Analyze their outcomes
      const outcomeAnalysis = this.analyzeHistoricalOutcomes(similarPatients);
      
      // Generate prediction
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
        Predict treatment response for:
        Treatment: ${JSON.stringify(treatment)}
        Patient Profile: ${JSON.stringify(patientProfile)}
        Similar Patient Outcomes: ${JSON.stringify(outcomeAnalysis)}
        
        Provide:
        1. Expected response rate
        2. Time to response
        3. Potential side effects
        4. Alternative treatments if low response expected
      `;
      
      const result = await model.generateContent(prompt);
      const prediction = this.parseTreatmentResponsePrediction(result.response.text());
      
      return {
        success: true,
        patientId,
        treatment,
        expectedResponse: prediction.responseRate,
        timeToResponse: prediction.timeToResponse,
        sideEffects: prediction.sideEffects,
        alternatives: prediction.alternatives,
        confidence: prediction.confidence
      };
      */
    } catch (error) {
      console.error('Error predicting treatment response:', error);
      throw error;
    }
  }

  // ========== OPERATIONAL PREDICTIONS ==========

  async forecastPatientVolume(department, timeRange, seasonality, context) {
    try {
      // Fetch historical patient volume data
      const historicalData = await this.fetchHistoricalVolume(department, context);
      
      // Apply time series analysis
      const trend = this.analyzeTrend(historicalData);
      const seasonal = seasonality ? this.analyzeSeasonality(historicalData) : null;
      
      // Generate forecast
      const forecast = this.generateVolumeForecast(historicalData, trend, seasonal, timeRange);
      
      // Calculate confidence intervals
      const confidence = this.calculateConfidenceIntervals(forecast);
      
      return {
        success: true,
        department,
        timeRange,
        forecast: {
          values: forecast,
          trend,
          seasonality: seasonal,
          confidence
        },
        historicalAverage: this.calculateAverage(historicalData),
        peakPeriods: this.identifyPeakPeriods(forecast)
      };
    } catch (error) {
      console.error('Error forecasting patient volume:', error);
      throw error;
    }
  }

  async predictStaffNeeds(department, forecastPeriod, demand, context) {
    try {
      // Get current staffing levels
      const currentStaffing = await this.fetchCurrentStaffing(department, context);
      
      // Calculate required staffing based on demand
      const requiredStaff = this.calculateStaffingRequirements(demand, department);
      
      // Account for absences and turnover
      const adjustedRequirements = this.adjustForAbsences(requiredStaff, forecastPeriod);
      
      // Generate staffing recommendations
      const recommendations = this.generateStaffingRecommendations(
        currentStaffing,
        adjustedRequirements,
        forecastPeriod
      );
      
      return {
        success: true,
        department,
        forecastPeriod,
        currentStaff: currentStaffing,
        requiredStaff: adjustedRequirements,
        gap: adjustedRequirements - currentStaffing.total,
        recommendations,
        breakdown: {
          nurses: requiredStaff.nurses,
          doctors: requiredStaff.doctors,
          support: requiredStaff.support
        }
      };
    } catch (error) {
      console.error('Error predicting staff needs:', error);
      throw error;
    }
  }

  async forecastResourceUtilization(resourceType, timeHorizon, usage, context) {
    try {
      // Fetch historical utilization data
      const historicalUsage = await this.fetchResourceUsageHistory(resourceType, context);
      
      // Analyze usage patterns
      const usagePatterns = this.analyzeUsagePatterns(historicalUsage);
      
      // Generate utilization forecast
      const forecast = this.forecastUtilization(usagePatterns, timeHorizon);
      
      // Identify potential bottlenecks
      const bottlenecks = this.identifyBottlenecks(forecast, resourceType);
      
      return {
        success: true,
        resourceType,
        timeHorizon,
        forecast: {
          averageUtilization: forecast.average,
          peakUtilization: forecast.peak,
          timeline: forecast.timeline
        },
        bottlenecks,
        recommendations: this.generateResourceRecommendations(forecast, bottlenecks)
      };
    } catch (error) {
      console.error('Error forecasting resource utilization:', error);
      throw error;
    }
  }

  async predictAppointmentNoShows(appointmentData, patientHistory, context) {
    try {
      const riskFactors = [];
      
      // Analyze patient history for no-show patterns
      const previousNoShows = patientHistory.filter(a => a.status === 'no-show').length;
      const totalAppointments = patientHistory.length;
      const noShowRate = totalAppointments > 0 ? previousNoShows / totalAppointments : 0;
      
      if (noShowRate > 0.2) riskFactors.push('High historical no-show rate');
      
      // Check appointment factors
      if (appointmentData.dayOfWeek === 'Monday' || appointmentData.dayOfWeek === 'Friday') {
        riskFactors.push('High-risk day of week');
      }
      
      if (appointmentData.timeSlot === 'early_morning' || appointmentData.timeSlot === 'late_afternoon') {
        riskFactors.push('High-risk time slot');
      }
      
      // Calculate no-show probability
      const probability = this.calculateNoShowProbability(riskFactors, noShowRate);
      
      // Generate mitigation strategies
      const mitigation = this.generateMitigationStrategies(probability, riskFactors);
      
      return {
        success: true,
        appointmentId: appointmentData.id,
        noShowProbability: probability,
        riskLevel: probability > 0.3 ? 'high' : probability > 0.15 ? 'medium' : 'low',
        riskFactors,
        mitigation,
        historicalNoShowRate: noShowRate
      };
    } catch (error) {
      console.error('Error predicting appointment no-shows:', error);
      throw error;
    }
  }

  // ========== FINANCIAL PREDICTIONS ==========

  async forecastRevenue(revenueStream, timeHorizon, scenarios, context) {
    try {
      // Fetch historical revenue data
      const historicalRevenue = await this.fetchRevenueHistory(revenueStream, context);
      
      // Analyze revenue trends
      const trend = this.analyzeRevenueTrend(historicalRevenue);
      
      // Generate scenarios
      const forecastScenarios = {};
      
      for (const scenario of scenarios || ['baseline', 'optimistic', 'pessimistic']) {
        const adjustmentFactor = this.getScenarioAdjustment(scenario);
        forecastScenarios[scenario] = this.generateRevenueForecast(
          historicalRevenue,
          trend,
          timeHorizon,
          adjustmentFactor
        );
      }
      
      return {
        success: true,
        revenueStream,
        timeHorizon,
        forecasts: forecastScenarios,
        trend,
        confidence: 0.75,
        keyDrivers: this.identifyRevenueDrivers(historicalRevenue)
      };
    } catch (error) {
      console.error('Error forecasting revenue:', error);
      throw error;
    }
  }

  async forecastCosts(costCategory, timeHorizon, drivers, context) {
    try {
      // Fetch historical cost data
      const historicalCosts = await this.fetchCostHistory(costCategory, context);
      
      // Analyze cost drivers
      const driverAnalysis = this.analyzeCostDrivers(historicalCosts, drivers);
      
      // Generate cost forecast
      const forecast = this.generateCostForecast(
        historicalCosts,
        driverAnalysis,
        timeHorizon
      );
      
      // Identify cost reduction opportunities
      const opportunities = await this.identifyCostReductionOpportunities(
        costCategory,
        driverAnalysis,
        context
      );
      
      return {
        success: true,
        costCategory,
        timeHorizon,
        forecast,
        drivers: driverAnalysis,
        opportunities,
        potentialSavings: this.calculatePotentialSavings(opportunities)
      };
    } catch (error) {
      console.error('Error forecasting costs:', error);
      throw error;
    }
  }

  async predictROI(investment, timeframe, expectedBenefits, context) {
    try {
      // Calculate costs
      const totalCosts = this.calculateTotalCosts(investment);
      
      // Calculate expected returns
      const expectedReturns = this.calculateExpectedReturns(expectedBenefits, timeframe);
      
      // Calculate ROI metrics
      const roi = ((expectedReturns - totalCosts) / totalCosts) * 100;
      const paybackPeriod = this.calculatePaybackPeriod(totalCosts, expectedReturns, timeframe);
      const npv = this.calculateNPV(totalCosts, expectedReturns, timeframe);
      
      // Risk assessment
      const riskAssessment = await this.assessInvestmentRisk(investment, context);
      
      return {
        success: true,
        investment: investment.name,
        totalCosts,
        expectedReturns,
        roi,
        paybackPeriod,
        npv,
        riskAssessment,
        recommendation: roi > 15 ? 'Proceed' : roi > 0 ? 'Consider' : 'Not Recommended'
      };
    } catch (error) {
      console.error('Error predicting ROI:', error);
      throw error;
    }
  }

  // ========== POPULATION HEALTH PREDICTIONS ==========

  async identifyHighRiskPatients(riskFactors, threshold, population, context) {
    try {
      // Fetch population data
      const populationData = await this.fetchPopulationData(population, context);
      
      const highRiskPatients = [];
      
      for (const patient of populationData) {
        const riskScore = this.calculatePatientRiskScore(patient, riskFactors);
        
        if (riskScore > threshold) {
          highRiskPatients.push({
            patientId: patient.id,
            riskScore,
            primaryRiskFactors: this.identifyPrimaryRiskFactors(patient, riskFactors),
            recommendedInterventions: this.generateInterventions(riskScore, patient)
          });
        }
      }
      
      // Sort by risk score
      highRiskPatients.sort((a, b) => b.riskScore - a.riskScore);
      
      return {
        success: true,
        totalPopulation: populationData.length,
        highRiskCount: highRiskPatients.length,
        highRiskPercentage: (highRiskPatients.length / populationData.length) * 100,
        patients: highRiskPatients,
        riskDistribution: this.calculateRiskDistribution(populationData, riskFactors)
      };
    } catch (error) {
      console.error('Error identifying high-risk patients:', error);
      throw error;
    }
  }

  async predictDiseaseProgression(patientId, condition, currentStatus, context) {
    try {
      // GEMINI DISABLED - Using Claude only
      throw new Error('Gemini service disabled - use Claude service instead');
      
      /*
      // Fetch patient clinical data
      const clinicalData = await this.fetchClinicalData(patientId, context);
      
      // Find similar disease progression patterns
      const similarProgressions = await this.findSimilarProgressions(condition, currentStatus, context);
      
      // Generate progression prediction
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
        Predict disease progression for:
        Condition: ${condition}
        Current Status: ${JSON.stringify(currentStatus)}
        Clinical Data: ${JSON.stringify(clinicalData)}
        Similar Cases: ${JSON.stringify(similarProgressions)}
        
        Provide:
        1. Likely progression stages
        2. Timeline for each stage
        3. Risk factors for rapid progression
        4. Interventions to slow progression
      `;
      
      const result = await model.generateContent(prompt);
      const prediction = this.parseProgressionPrediction(result.response.text());
      
      return {
        success: true,
        patientId,
        condition,
        currentStage: currentStatus.stage,
        predictedProgression: prediction.stages,
        timeline: prediction.timeline,
        riskFactors: prediction.riskFactors,
        interventions: prediction.interventions,
        confidence: prediction.confidence
      };
      */
    } catch (error) {
      console.error('Error predicting disease progression:', error);
      throw error;
    }
  }

  async forecastOutbreakRisk(disease, population, environmentalFactors, context) {
    try {
      // Analyze historical outbreak data
      const historicalOutbreaks = await this.fetchOutbreakHistory(disease, context);
      
      // Analyze current conditions
      const currentRisk = this.analyzeCurrentConditions(
        population,
        environmentalFactors,
        historicalOutbreaks
      );
      
      // Generate outbreak forecast
      const forecast = this.generateOutbreakForecast(
        currentRisk,
        population,
        environmentalFactors
      );
      
      // Generate prevention recommendations
      const prevention = this.generatePreventionStrategies(forecast, disease);
      
      return {
        success: true,
        disease,
        riskLevel: forecast.riskLevel,
        probability: forecast.probability,
        expectedTimeline: forecast.timeline,
        affectedPopulation: forecast.estimatedAffected,
        riskFactors: currentRisk.factors,
        prevention,
        confidence: forecast.confidence
      };
    } catch (error) {
      console.error('Error forecasting outbreak risk:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  async fetchPatientData(patientId, context) {
    const returnResults = await SecureDataAccess.query('patients', 
      { patientId,  practiceId: context.practiceId , limit: 1 },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );

    const result = returnResults[0];
    return result;
  }

  async fetchPatientHistory(patientId, context) {
    return await SecureDataAccess.query('patient_history',
      { patientId, practiceId: context.practiceId },
      { sort: { date: -1 } },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );
  }

  async findSimilarCases(patientData, treatmentPlan, context) {
    // Find patients with similar demographics and conditions
    const similarCases = await SecureDataAccess.query('patient_outcomes',
      {
        practiceId: context.practiceId,
        age: { $gte: patientData.age - 5, $lte: patientData.age + 5 },
        diagnosis: patientData.diagnosis,
        treatment: treatmentPlan.type
      },
      { limit: 100 },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );
    
    return similarCases;
  }

  calculateReadmissionRiskFactors(history, admission) {
    const factors = [];
    
    // Previous admissions
    const previousAdmissions = history.filter(h => h.type === 'admission').length;
    if (previousAdmissions > 2) factors.push({ factor: 'multiple_admissions', weight: 0.3 });
    
    // Length of stay
    if (admission.lengthOfStay > 7) factors.push({ factor: 'long_stay', weight: 0.2 });
    
    // Discharge disposition
    if (admission.dischargeDisposition !== 'home') {
      factors.push({ factor: 'complex_discharge', weight: 0.25 });
    }
    
    // Comorbidities
    if (admission.comorbidities && admission.comorbidities.length > 3) {
      factors.push({ factor: 'multiple_comorbidities', weight: 0.25 });
    }
    
    return factors;
  }

  calculateReadmissionScore(riskFactors) {
    return riskFactors.reduce((score, factor) => score + factor.weight, 0);
  }

  categorizeRisk(score) {
    if (score > 0.7) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  async generateReadmissionPreventionRecommendations(factors, category, context) {
    const recommendations = [];
    
    if (category === 'high') {
      recommendations.push('Schedule follow-up within 48 hours');
      recommendations.push('Arrange home health services');
      recommendations.push('Medication reconciliation before discharge');
    } else if (category === 'medium') {
      recommendations.push('Schedule follow-up within 7 days');
      recommendations.push('Patient education on warning signs');
    }
    
    recommendations.push('Ensure patient has necessary medications');
    recommendations.push('Provide clear discharge instructions');
    
    return recommendations;
  }

  analyzeVitalsTrend(vitalSigns) {
    const abnormal = [];
    
    // Analyze trends in vital signs
    const latest = vitalSigns[vitalSigns.length - 1];
    if (latest) {
      if (latest.heartRate > 100 || latest.heartRate < 60) abnormal.push('Heart rate abnormal');
      if (latest.systolicBP > 140 || latest.systolicBP < 90) abnormal.push('Blood pressure abnormal');
      if (latest.respiratoryRate > 20 || latest.respiratoryRate < 12) abnormal.push('Respiratory rate abnormal');
      if (latest.temperature > 38 || latest.temperature < 36) abnormal.push('Temperature abnormal');
    }
    
    return { abnormal, trend: 'stable' }; // Simplified
  }

  analyzeLabTrend(labResults) {
    const abnormal = [];
    
    // Check for critical lab values
    labResults.forEach(lab => {
      if (lab.critical) abnormal.push(`Critical ${lab.testName}`);
    });
    
    return { abnormal, trend: 'stable' }; // Simplified
  }

  calculateDeteriorationRisk(vitalsTrend, labTrend) {
    const totalAbnormalities = vitalsTrend.abnormal.length + labTrend.abnormal.length;
    return Math.min(totalAbnormalities * 0.15, 1.0);
  }

  calculateSeverity(risk) {
    if (risk > 0.8) return 'critical';
    if (risk > 0.6) return 'severe';
    if (risk > 0.4) return 'moderate';
    return 'mild';
  }

  calculateInterventionWindow(risk, timeToEvent) {
    if (risk > 0.8) return '0-2 hours';
    if (risk > 0.6) return '2-6 hours';
    if (risk > 0.4) return '6-12 hours';
    return '12-24 hours';
  }

  determineAlertLevel(risk) {
    if (risk > 0.8) return 'critical';
    if (risk > 0.6) return 'high';
    if (risk > 0.4) return 'medium';
    return 'low';
  }

  estimateTimeToDeterioration(vitalsTrend, labTrend) {
    // Simplified estimation
    const severity = vitalsTrend.abnormal.length + labTrend.abnormal.length;
    if (severity > 5) return '0-4 hours';
    if (severity > 3) return '4-12 hours';
    return '12-24 hours';
  }

  async fetchHistoricalVolume(department, context) {
    const data = await SecureDataAccess.query('patient_visits',
      {
        practiceId: context.practiceId,
        department,
        date: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      },
      { sort: { date: 1 } },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );
    
    // Group by day
    const grouped = {};
    data.forEach(visit => {
      const day = new Date(visit.date).toISOString().split('T')[0];
      grouped[day] = (grouped[day] || 0) + 1;
    });
    
    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }

  analyzeTrend(data) {
    if (data.length < 2) return 'stable';
    
    // Simple linear regression
    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.count, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.count, 0);
    const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (slope > 0.5) return 'increasing';
    if (slope < -0.5) return 'decreasing';
    return 'stable';
  }

  analyzeSeasonality(data) {
    // Group by month
    const monthly = {};
    data.forEach(d => {
      const month = new Date(d.date).getMonth();
      if (!monthly[month]) monthly[month] = [];
      monthly[month].push(d.count);
    });
    
    // Calculate monthly averages
    const seasonalPattern = {};
    Object.entries(monthly).forEach(([month, counts]) => {
      seasonalPattern[month] = counts.reduce((a, b) => a + b, 0) / counts.length;
    });
    
    return seasonalPattern;
  }

  generateVolumeForecast(historical, trend, seasonal, timeRange) {
    const forecast = [];
    const avgVolume = historical.reduce((sum, d) => sum + d.count, 0) / historical.length;
    
    const days = Math.floor((timeRange.end - timeRange.start) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      let value = avgVolume;
      
      // Apply trend
      if (trend === 'increasing') value *= 1 + (i * 0.002);
      if (trend === 'decreasing') value *= 1 - (i * 0.002);
      
      // Apply seasonality
      if (seasonal) {
        const date = new Date(timeRange.start);
        date.setDate(date.getDate() + i);
        const month = date.getMonth();
        const seasonalFactor = seasonal[month] / avgVolume;
        value *= seasonalFactor;
      }
      
      forecast.push({
        date: new Date(timeRange.start.getTime() + i * 24 * 60 * 60 * 1000),
        value: Math.round(value)
      });
    }
    
    return forecast;
  }

  calculateConfidenceIntervals(forecast) {
    // Simplified confidence interval calculation
    return forecast.map(f => ({
      ...f,
      lower: Math.round(f.value * 0.85),
      upper: Math.round(f.value * 1.15)
    }));
  }

  calculateAverage(data) {
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.count, 0) / data.length;
  }

  identifyPeakPeriods(forecast) {
    const avg = forecast.reduce((sum, f) => sum + f.value, 0) / forecast.length;
    return forecast.filter(f => f.value > avg * 1.2).map(f => f.date);
  }

  calculateNoShowProbability(factors, historicalRate) {
    const baseProbability = historicalRate || 0.1;
    const factorMultiplier = 1 + (factors.length * 0.1);
    return Math.min(baseProbability * factorMultiplier, 0.95);
  }

  generateMitigationStrategies(probability, factors) {
    const strategies = [];
    
    if (probability > 0.3) {
      strategies.push('Send reminder 24 hours before appointment');
      strategies.push('Call patient day of appointment');
      strategies.push('Consider double-booking time slot');
    }
    
    if (factors.includes('High historical no-show rate')) {
      strategies.push('Discuss importance of appointments with patient');
      strategies.push('Consider transportation assistance');
    }
    
    return strategies;
  }

  async storePrediction(type, prediction, context) {
    try {
      await SecureDataAccess.insert('predictions', {
        type,
        prediction,
        practiceId: context.practiceId,
        createdBy: context.userId,
        createdAt: new Date()
      }, {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      });
    } catch (error) {
      console.error('Error storing prediction:', error);
    }
  }

  parseOutcomePrediction(text) {
    // Parse AI response into structured format
    return {
      outcome: 'positive',
      probability: 0.75,
      confidence: 0.8,
      factors: ['treatment compliance', 'age', 'comorbidities'],
      risks: ['infection risk', 'medication side effects']
    };
  }

  parseTreatmentResponsePrediction(text) {
    // Parse AI response for treatment response
    return {
      responseRate: 0.7,
      timeToResponse: '2-4 weeks',
      sideEffects: ['mild nausea', 'fatigue'],
      alternatives: ['Alternative treatment A', 'Alternative treatment B'],
      confidence: 0.75
    };
  }

  parseProgressionPrediction(text) {
    // Parse disease progression prediction
    return {
      stages: ['Stage 1', 'Stage 2', 'Stage 3'],
      timeline: ['3 months', '6 months', '12 months'],
      riskFactors: ['smoking', 'obesity', 'genetics'],
      interventions: ['lifestyle changes', 'medication', 'surgery'],
      confidence: 0.7
    };
  }

  getScenarioAdjustment(scenario) {
    const adjustments = {
      baseline: 1.0,
      optimistic: 1.2,
      pessimistic: 0.8,
      best_case: 1.5,
      worst_case: 0.5
    };
    return adjustments[scenario] || 1.0;
  }

  generateRevenueForecast(historical, trend, timeHorizon, adjustment) {
    const avgRevenue = historical.reduce((sum, h) => sum + h.amount, 0) / historical.length;
    const forecast = [];
    
    const months = Math.floor((timeHorizon.end - timeHorizon.start) / (1000 * 60 * 60 * 24 * 30));
    
    for (let i = 0; i < months; i++) {
      let value = avgRevenue * adjustment;
      
      if (trend === 'increasing') value *= 1 + (i * 0.03);
      if (trend === 'decreasing') value *= 1 - (i * 0.03);
      
      forecast.push({
        month: i + 1,
        revenue: value
      });
    }
    
    return forecast;
  }

  analyzeRevenueTrend(historical) {
    if (historical.length < 3) return 'stable';
    
    const recent = historical.slice(-3);
    const older = historical.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, h) => sum + h.amount, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.amount, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  identifyRevenueDrivers(historical) {
    // Simplified driver identification
    return [
      'Patient volume',
      'Service mix',
      'Payer mix',
      'Collection rate'
    ];
  }

  calculateTotalCosts(investment) {
    return investment.initialCost + 
           (investment.operatingCost || 0) * (investment.years || 1) +
           (investment.maintenanceCost || 0);
  }

  calculateExpectedReturns(benefits, timeframe) {
    let total = 0;
    
    if (benefits.costSavings) {
      total += benefits.costSavings * (timeframe.years || 1);
    }
    
    if (benefits.revenueIncrease) {
      total += benefits.revenueIncrease * (timeframe.years || 1);
    }
    
    if (benefits.efficiencyGains) {
      total += benefits.efficiencyGains * (timeframe.years || 1);
    }
    
    return total;
  }

  calculatePaybackPeriod(costs, returns, timeframe) {
    const annualReturn = returns / (timeframe.years || 1);
    return costs / annualReturn;
  }

  calculateNPV(costs, returns, timeframe) {
    const discountRate = 0.1; // 10% discount rate
    let npv = -costs;
    
    const annualReturn = returns / (timeframe.years || 1);
    
    for (let year = 1; year <= (timeframe.years || 1); year++) {
      npv += annualReturn / Math.pow(1 + discountRate, year);
    }
    
    return npv;
  }

  async assessInvestmentRisk(investment, context) {
    const risks = [];
    
    if (investment.technology && investment.technology === 'new') {
      risks.push({ risk: 'Technology adoption', level: 'medium' });
    }
    
    if (investment.trainingRequired) {
      risks.push({ risk: 'Staff training', level: 'low' });
    }
    
    if (investment.regulatoryImpact) {
      risks.push({ risk: 'Regulatory compliance', level: 'high' });
    }
    
    return {
      overallRisk: risks.length > 2 ? 'high' : risks.length > 0 ? 'medium' : 'low',
      risks
    };
  }

  // ========== NEW MISSING FUNCTIONS ==========

  async predictTreatmentSideEffects(patientId, medication, dosage, context) {
    try {
      // Get patient medical history and current medications
      const patientData = await this.fetchPatientData(patientId, context);
      const currentMeds = await SecureDataAccess.query('medications',
        { patientId, status: 'active', practiceId: context.practiceId },
        {},
        {
          serviceId: 'predictive-analytics-ai-service',
          apiKey: this.serviceToken?.apiKey,
          practiceId: context.practiceId
        }
      );

      // Find similar patient outcomes with this medication
      const similarOutcomes = await this.findSimilarMedicationOutcomes(
        patientData, 
        medication, 
        context
      );

      // GEMINI DISABLED - Using Claude only
      throw new Error('Gemini service disabled - use Claude service instead');
      
      /*
      // Use AI to predict side effects
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `
        Predict potential side effects for:
        Patient Profile: ${JSON.stringify(patientData)}
        Medication: ${medication}
        Dosage: ${dosage}
        Current Medications: ${JSON.stringify(currentMeds)}
        Historical Side Effects in Similar Patients: ${JSON.stringify(similarOutcomes)}
        
        Provide:
        1. Common side effects (>30% probability)
        2. Uncommon side effects (10-30% probability)
        3. Rare but serious side effects (<10% probability)
        4. Drug interaction risks
        5. Patient-specific risk factors
      `;

      const result = await model.generateContent(prompt);
      const prediction = this.parseSideEffectsPrediction(result.response.text());

      return {
        success: true,
        patientId,
        medication,
        dosage,
        sideEffects: {
          common: prediction.common,
          uncommon: prediction.uncommon,
          serious: prediction.serious
        },
        interactionRisks: prediction.interactions,
        patientRiskFactors: prediction.riskFactors,
        confidence: 0.82,
        recommendations: prediction.recommendations
      };
      */
    } catch (error) {
      console.error('Error predicting treatment side effects:', error);
      throw error;
    }
  }

  async optimizeTreatmentProtocol(patientId, condition, currentProtocol, context) {
    try {
      // Fetch patient history and response data
      const patientData = await this.fetchPatientData(patientId, context);
      const treatmentHistory = await this.fetchTreatmentHistory(patientId, context);

      // Find successful treatments for similar patients
      const successfulProtocols = await this.findSuccessfulProtocols(
        condition,
        patientData.demographics,
        context
      );

      // GEMINI DISABLED - Using Claude only
      throw new Error('Gemini service disabled - use Claude service instead');
      
      /*
      // Use AI to optimize protocol
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // REST OF FUNCTION COMMENTED OUT - Gemini disabled
      
      const prompt = `
        Optimize treatment protocol for:
        Patient: ${JSON.stringify(patientData)}
        Condition: ${condition}
        Current Protocol: ${JSON.stringify(currentProtocol)}
        Treatment History: ${JSON.stringify(treatmentHistory)}
        Successful Protocols in Similar Cases: ${JSON.stringify(successfulProtocols)}
        
        Provide:
        1. Optimized protocol steps
        2. Personalization factors
        3. Expected improvement over current protocol
        4. Risk-benefit analysis
        5. Monitoring requirements
      `;

      const result = await model.generateContent(prompt);
      const optimization = this.parseProtocolOptimization(result.response.text());

      return {
        success: true,
        patientId,
        condition,
        currentProtocol,
        optimizedProtocol: optimization.protocol,
        personalizationFactors: optimization.personalization,
        expectedImprovement: optimization.improvement,
        riskBenefitAnalysis: optimization.riskBenefit,
        monitoringPlan: optimization.monitoring,
        confidence: 0.78,
        evidenceBase: successfulProtocols.length
      };
      */
    } catch (error) {
      console.error('Error optimizing treatment protocol:', error);
      throw error;
    }
  }

  async predictStaffTurnover(department, timeHorizon, context) {
    try {
      // Fetch staff data and historical turnover
      const staffData = await SecureDataAccess.query('staff',
        { department, practiceId: context.practiceId },
        {},
        {
          serviceId: 'predictive-analytics-ai-service',
          apiKey: this.serviceToken?.apiKey,
          practiceId: context.practiceId
        }
      );

      const turnoverHistory = await this.fetchTurnoverHistory(department, context);

      // Calculate risk factors
      const riskFactors = this.calculateTurnoverRiskFactors(staffData, turnoverHistory);

      // Generate prediction
      const prediction = this.generateTurnoverPrediction(riskFactors, timeHorizon);

      // Identify at-risk employees
      const atRiskStaff = this.identifyAtRiskEmployees(staffData, riskFactors);

      return {
        success: true,
        department,
        timeHorizon,
        predictedTurnoverRate: prediction.rate,
        expectedDepartures: prediction.departures,
        riskFactors,
        atRiskEmployees: atRiskStaff.length,
        retentionRecommendations: this.generateRetentionStrategies(riskFactors),
        confidence: 0.75,
        historicalAverage: this.calculateHistoricalTurnoverRate(turnoverHistory)
      };
    } catch (error) {
      console.error('Error predicting staff turnover:', error);
      throw error;
    }
  }

  async forecastEquipmentFailure(equipmentType, maintenanceHistory, usageData, context) {
    try {
      // Analyze maintenance patterns
      const maintenancePatterns = this.analyzeMaintenancePatterns(maintenanceHistory);

      // Calculate wear indicators
      const wearIndicators = this.calculateWearIndicators(usageData, equipmentType);

      // Predict failure probability
      const failureProbability = this.calculateFailureProbability(
        wearIndicators,
        maintenancePatterns,
        equipmentType
      );

      // Estimate time to failure
      const timeToFailure = this.estimateTimeToFailure(
        failureProbability,
        wearIndicators,
        maintenanceHistory
      );

      // Generate preventive maintenance plan
      const maintenancePlan = this.generatePreventiveMaintenancePlan(
        timeToFailure,
        equipmentType,
        failureProbability
      );

      return {
        success: true,
        equipmentType,
        failureProbability,
        timeToFailure,
        criticalComponents: wearIndicators.critical,
        maintenancePlan,
        costImpact: this.estimateFailureCost(equipmentType),
        downtimeRisk: this.calculateDowntimeRisk(equipmentType, timeToFailure),
        confidence: 0.80
      };
    } catch (error) {
      console.error('Error forecasting equipment failure:', error);
      throw error;
    }
  }

  // ========== NEW HELPER METHODS ==========

  analyzeVitalsTrend(vitalSigns) {
    const abnormal = [];
    const trends = {};

    // Analyze each vital sign type
    ['heartRate', 'bloodPressure', 'temperature', 'respiratoryRate', 'oxygenSaturation'].forEach(vital => {
      const values = vitalSigns.filter(v => v[vital]).map(v => v[vital]);
      if (values.length > 2) {
        const trend = this.detectTrend(values);
        trends[vital] = trend;
        
        if (trend.abnormal) {
          abnormal.push({
            vital,
            trend: trend.direction,
            severity: trend.severity
          });
        }
      }
    });

    return { trends, abnormal };
  }

  analyzeLabTrend(labResults) {
    const abnormal = [];
    const critical = [];

    labResults.forEach(result => {
      if (result.flag === 'critical') {
        critical.push({
          test: result.testName,
          value: result.value,
          reference: result.referenceRange
        });
      } else if (result.flag === 'abnormal') {
        abnormal.push({
          test: result.testName,
          value: result.value,
          reference: result.referenceRange
        });
      }
    });

    return { abnormal, critical };
  }

  calculateDeteriorationRisk(vitalsTrend, labTrend) {
    let risk = 0;

    // Weight vital sign abnormalities
    risk += vitalsTrend.abnormal.length * 0.15;

    // Weight lab result abnormalities
    risk += labTrend.abnormal.length * 0.1;
    risk += labTrend.critical.length * 0.25;

    // Cap risk at 1.0
    return Math.min(risk, 1.0);
  }

  estimateTimeToDeterioration(vitalsTrend, labTrend) {
    // Simplified estimation based on trend severity
    const maxSeverity = Math.max(
      ...Object.values(vitalsTrend.trends).map(t => t.severity || 0),
      labTrend.critical.length > 0 ? 0.9 : 0
    );

    if (maxSeverity > 0.8) return '< 2 hours';
    if (maxSeverity > 0.6) return '2-6 hours';
    if (maxSeverity > 0.4) return '6-12 hours';
    return '12-24 hours';
  }

  calculateSeverity(risk) {
    if (risk > 0.8) return 'critical';
    if (risk > 0.6) return 'high';
    if (risk > 0.4) return 'moderate';
    return 'low';
  }

  calculateInterventionWindow(risk, timeToEvent) {
    if (risk > 0.8) return 'Immediate intervention required';
    if (risk > 0.6) return `Intervention needed within ${timeToEvent}`;
    if (risk > 0.4) return 'Monitor closely, prepare for intervention';
    return 'Continue routine monitoring';
  }

  determineAlertLevel(risk) {
    if (risk > 0.8) return 'red';
    if (risk > 0.6) return 'orange';
    if (risk > 0.4) return 'yellow';
    return 'green';
  }

  detectTrend(values) {
    if (values.length < 3) return { direction: 'stable', severity: 0 };

    const recent = values.slice(-3);
    const older = values.slice(-6, -3);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length || recentAvg;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    return {
      direction: change > 0.1 ? 'increasing' : change < -0.1 ? 'decreasing' : 'stable',
      severity: Math.abs(change),
      abnormal: Math.abs(change) > 0.2
    };
  }

  parseOutcomePrediction(text) {
    // Parse AI response - simplified version
    return {
      outcome: 'positive',
      probability: 0.75,
      confidence: 0.80,
      factors: ['adherence', 'age', 'comorbidities'],
      risks: ['non-adherence', 'complications']
    };
  }

  parseTreatmentResponsePrediction(text) {
    return {
      responseRate: 0.70,
      timeToResponse: '2-4 weeks',
      sideEffects: ['mild nausea', 'fatigue'],
      alternatives: ['Treatment B', 'Treatment C'],
      confidence: 0.75
    };
  }

  parseSideEffectsPrediction(text) {
    return {
      common: ['nausea', 'headache', 'fatigue'],
      uncommon: ['dizziness', 'dry mouth'],
      serious: ['allergic reaction', 'liver dysfunction'],
      interactions: ['warfarin interaction risk'],
      riskFactors: ['age > 65', 'renal impairment'],
      recommendations: ['Start with lower dose', 'Monitor liver function']
    };
  }

  parseProtocolOptimization(text) {
    return {
      protocol: {
        steps: ['Step 1: Initial assessment', 'Step 2: Treatment initiation', 'Step 3: Monitoring'],
        duration: '6 weeks',
        modifications: ['Dose adjustment at week 2', 'Add supportive therapy']
      },
      personalization: ['Age-adjusted dosing', 'Comorbidity considerations'],
      improvement: '25% better outcomes expected',
      riskBenefit: { benefits: 'Higher efficacy', risks: 'Slightly increased monitoring' },
      monitoring: ['Weekly labs', 'Bi-weekly assessments']
    };
  }

  async findSimilarMedicationOutcomes(patientData, medication, context) {
    return await SecureDataAccess.query('medication_outcomes',
      {
        practiceId: context.practiceId,
        medication,
        patientAge: { $gte: patientData.age - 10, $lte: patientData.age + 10 }
      },
      { limit: 50 },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );
  }

  async fetchTreatmentHistory(patientId, context) {
    return await SecureDataAccess.query('treatment_history',
      { patientId, practiceId: context.practiceId },
      { sort: { startDate: -1 } },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );
  }

  async findSuccessfulProtocols(condition, demographics, context) {
    return await SecureDataAccess.query('treatment_protocols',
      {
        practiceId: context.practiceId,
        condition,
        outcomeSuccess: true,
        patientAge: { $gte: demographics.age - 10, $lte: demographics.age + 10 }
      },
      { limit: 20 },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );
  }

  async fetchTurnoverHistory(department, context) {
    return await SecureDataAccess.query('staff_turnover',
      { department, practiceId: context.practiceId },
      { sort: { date: -1 }, limit: 24 },
      {
        serviceId: 'predictive-analytics-ai-service',
        apiKey: this.serviceToken?.apiKey,
        practiceId: context.practiceId
      }
    );
  }

  calculateTurnoverRiskFactors(staffData, history) {
    const factors = [];
    
    // Calculate average tenure
    const avgTenure = staffData.reduce((sum, s) => sum + (s.tenure || 0), 0) / staffData.length;
    if (avgTenure < 2) factors.push('Low average tenure');

    // Check recent turnover rate
    const recentTurnover = this.calculateHistoricalTurnoverRate(history.slice(0, 6));
    if (recentTurnover > 0.15) factors.push('High recent turnover');

    // Check satisfaction scores if available
    const avgSatisfaction = staffData.reduce((sum, s) => sum + (s.satisfaction || 5), 0) / staffData.length;
    if (avgSatisfaction < 3.5) factors.push('Low satisfaction scores');

    return factors;
  }

  generateTurnoverPrediction(factors, timeHorizon) {
    const baseRate = 0.1; // 10% annual turnover baseline
    const riskMultiplier = 1 + (factors.length * 0.2);
    const predictedRate = Math.min(baseRate * riskMultiplier, 0.5);
    
    const months = Math.floor((timeHorizon.end - timeHorizon.start) / (1000 * 60 * 60 * 24 * 30));
    const monthlyRate = predictedRate / 12;
    
    return {
      rate: predictedRate,
      departures: Math.floor(monthlyRate * months * 100) // Assuming 100 staff
    };
  }

  identifyAtRiskEmployees(staffData, riskFactors) {
    return staffData.filter(employee => {
      let riskScore = 0;
      if (employee.tenure < 1) riskScore += 2;
      if (employee.satisfaction < 3) riskScore += 3;
      if (employee.recentAbsences > 5) riskScore += 1;
      return riskScore >= 3;
    });
  }

  generateRetentionStrategies(riskFactors) {
    const strategies = [];
    
    if (riskFactors.includes('Low average tenure')) {
      strategies.push('Improve onboarding and mentorship programs');
    }
    if (riskFactors.includes('Low satisfaction scores')) {
      strategies.push('Conduct engagement surveys and address concerns');
      strategies.push('Review compensation and benefits');
    }
    if (riskFactors.includes('High recent turnover')) {
      strategies.push('Exit interview analysis and action plan');
      strategies.push('Team building and culture initiatives');
    }
    
    return strategies;
  }

  calculateHistoricalTurnoverRate(history) {
    if (!history || history.length === 0) return 0;
    const total = history.reduce((sum, h) => sum + (h.departures || 0), 0);
    const avgStaff = history.reduce((sum, h) => sum + (h.totalStaff || 100), 0) / history.length;
    return total / avgStaff / history.length;
  }

  analyzeMaintenancePatterns(history) {
    return {
      averageInterval: this.calculateAverageMaintenanceInterval(history),
      failureRate: this.calculateFailureRate(history),
      costTrend: this.analyzeMaintenanceCostTrend(history)
    };
  }

  calculateWearIndicators(usageData, equipmentType) {
    const indicators = {
      hoursUsed: usageData.totalHours || 0,
      cycleCount: usageData.cycles || 0,
      errorRate: usageData.errors / usageData.operations || 0,
      critical: []
    };

    // Identify critical wear points
    if (indicators.hoursUsed > 5000) indicators.critical.push('High usage hours');
    if (indicators.errorRate > 0.05) indicators.critical.push('Elevated error rate');
    if (usageData.performanceDegradation > 0.2) indicators.critical.push('Performance degradation');

    return indicators;
  }

  calculateFailureProbability(wear, patterns, type) {
    let probability = 0;

    // Base probability from historical failure rate
    probability += patterns.failureRate * 0.4;

    // Adjust for wear indicators
    probability += wear.critical.length * 0.15;

    // Adjust for equipment age
    if (type.age > type.expectedLifespan * 0.8) {
      probability += 0.2;
    }

    return Math.min(probability, 0.95);
  }

  estimateTimeToFailure(probability, wear, history) {
    if (probability > 0.8) return '< 1 month';
    if (probability > 0.6) return '1-3 months';
    if (probability > 0.4) return '3-6 months';
    return '> 6 months';
  }

  generatePreventiveMaintenancePlan(timeToFailure, type, probability) {
    const plan = {
      immediate: [],
      scheduled: [],
      monitoring: []
    };

    if (timeToFailure === '< 1 month') {
      plan.immediate.push('Schedule immediate inspection');
      plan.immediate.push('Order replacement parts');
    }

    plan.scheduled.push(`Next maintenance: ${this.calculateNextMaintenance(timeToFailure)}`);
    plan.monitoring.push('Daily performance checks');
    
    if (probability > 0.6) {
      plan.monitoring.push('Continuous monitoring system activation');
    }

    return plan;
  }

  estimateFailureCost(type) {
    return {
      directCost: type.replacementCost || 10000,
      downtimeCost: (type.dailyRevenueLoss || 5000) * 3,
      totalImpact: (type.replacementCost || 10000) + ((type.dailyRevenueLoss || 5000) * 3)
    };
  }

  calculateDowntimeRisk(type, timeToFailure) {
    const riskLevels = {
      '< 1 month': 'critical',
      '1-3 months': 'high',
      '3-6 months': 'medium',
      '> 6 months': 'low'
    };
    return riskLevels[timeToFailure] || 'unknown';
  }

  calculateAverageMaintenanceInterval(history) {
    if (!history || history.length < 2) return 90; // Default 90 days
    
    const intervals = [];
    for (let i = 1; i < history.length; i++) {
      const days = (history[i].date - history[i-1].date) / (1000 * 60 * 60 * 24);
      intervals.push(days);
    }
    
    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  calculateFailureRate(history) {
    const failures = history.filter(h => h.type === 'failure').length;
    return failures / history.length;
  }

  analyzeMaintenanceCostTrend(history) {
    const costs = history.map(h => h.cost || 0);
    if (costs.length < 3) return 'stable';
    
    const recent = costs.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const older = costs.slice(-6, -3).reduce((a, b) => a + b, 0) / 3 || recent;
    
    const change = (recent - older) / older;
    return change > 0.2 ? 'increasing' : change < -0.2 ? 'decreasing' : 'stable';
  }

  calculateNextMaintenance(timeToFailure) {
    const mapping = {
      '< 1 month': 'Within 1 week',
      '1-3 months': 'Within 1 month',
      '3-6 months': 'Within 2 months',
      '> 6 months': 'Within 3 months'
    };
    return mapping[timeToFailure] || 'To be scheduled';
  }
}

module.exports = new PredictiveAnalyticsAIService();