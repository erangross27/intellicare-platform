/**
 * Temporal Pattern Engine
 * 
 * Detects time-based patterns in user behavior.
 * Identifies daily routines, peak usage times, and seasonal patterns.
 */

const { LearningEventBusManager, LEARNING_EVENTS } = require('./learningEventBus');
const { LearningConfigManager } = require('./learningConfigService');
const serviceAccountManager = require('../serviceAccountManager');

class TemporalPatternEngine {
  constructor() {
    this.serviceId = 'temporal-pattern-engine';
    this.eventBus = null;
    this.config = null;
    this.temporalData = new Map(); // userId -> temporal data
    this.dailyPatterns = new Map(); // userId -> daily patterns
    this.weeklyPatterns = new Map(); // userId -> weekly patterns
    this.monthlyPatterns = new Map(); // userId -> monthly patterns
    this.initialized = false;
    this.stats = {
      eventsProcessed: 0,
      patternsDetected: 0,
      usersAnalyzed: 0
    };
  }

  async initialize() {
    if (this.initialized) return;

        // Authenticate service
        try {
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
        } catch (error) {
            console.error(`Failed to authenticate ${this.serviceId}:`, error.message);
        }
    
    try {
      // Get singleton instances
      this.eventBus = LearningEventBusManager.getInstance();
      this.config = LearningConfigManager.getInstance();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      // Load configuration
      this.loadConfig();
      
      // Start analysis interval
      this.startTemporalAnalysis();
      
      this.initialized = true;
      console.log('✅ Temporal Pattern Engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Temporal Pattern Engine:', error);
      throw error;
    }
  }

  /**
   * Load configuration
   */
  loadConfig() {
    const thresholds = this.config.getThreshold('temporal');
    this.timeWindowMinutes = thresholds?.timeWindowMinutes || 30;
    this.minOccurrences = thresholds?.minOccurrences || 5;
    this.seasonalityThreshold = thresholds?.seasonalityThreshold || 0.7;
    this.trendThreshold = thresholds?.trendThreshold || 0.3;
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents() {
    // Listen for interaction events
    this.eventBus.subscribe(LEARNING_EVENTS.INTERACTION_CAPTURED, async (event) => {
      await this.processTemporalEvent(event.data);
    });
    
    // Listen for session completions
    this.eventBus.subscribe(LEARNING_EVENTS.SESSION_COMPLETED, async (event) => {
      await this.analyzeSessionTiming(event.data);
    });
  }

  /**
   * Process temporal event
   */
  async processTemporalEvent(interaction) {
    try {
      const userId = interaction.userId;
      const timestamp = new Date(interaction.timestamp);
      
      if (!userId) return;
      
      // Get or create temporal data for user
      if (!this.temporalData.has(userId)) {
        this.temporalData.set(userId, {
          events: [],
          hourlyDistribution: new Array(24).fill(0),
          dailyDistribution: new Array(7).fill(0),
          monthlyDistribution: new Array(31).fill(0),
          functionalTiming: new Map()
        });
      }
      
      const userData = this.temporalData.get(userId);
      
      // Store event with temporal metadata
      const temporalEvent = {
        functionName: interaction.functionName,
        timestamp: timestamp,
        hour: timestamp.getHours(),
        dayOfWeek: timestamp.getDay(),
        dayOfMonth: timestamp.getDate(),
        month: timestamp.getMonth(),
        year: timestamp.getFullYear(),
        timeOfDay: this.getTimeOfDay(timestamp.getHours()),
        isWeekend: timestamp.getDay() === 0 || timestamp.getDay() === 6,
        isBusinessHours: this.isBusinessHours(timestamp)
      };
      
      userData.events.push(temporalEvent);
      
      // Update distributions
      userData.hourlyDistribution[temporalEvent.hour]++;
      userData.dailyDistribution[temporalEvent.dayOfWeek]++;
      userData.monthlyDistribution[temporalEvent.dayOfMonth - 1]++;
      
      // Track function timing
      if (!userData.functionalTiming.has(interaction.functionName)) {
        userData.functionalTiming.set(interaction.functionName, {
          times: [],
          preferredHours: new Array(24).fill(0),
          preferredDays: new Array(7).fill(0)
        });
      }
      
      const funcTiming = userData.functionalTiming.get(interaction.functionName);
      funcTiming.times.push(timestamp);
      funcTiming.preferredHours[temporalEvent.hour]++;
      funcTiming.preferredDays[temporalEvent.dayOfWeek]++;
      
      // Detect patterns if enough data
      if (userData.events.length >= this.minOccurrences) {
        await this.detectTemporalPatterns(userId, userData);
      }
      
      this.stats.eventsProcessed++;
      
    } catch (error) {
      console.error('Error processing temporal event:', error);
    }
  }

  /**
   * Analyze session timing
   */
  async analyzeSessionTiming(sessionData) {
    try {
      const userId = sessionData.userId;
      const sessionStart = new Date(sessionData.startTime);
      const sessionEnd = new Date(sessionData.endTime || Date.now());
      const duration = sessionEnd - sessionStart;
      
      // Analyze session patterns
      const sessionPattern = {
        startHour: sessionStart.getHours(),
        dayOfWeek: sessionStart.getDay(),
        duration: duration,
        timeOfDay: this.getTimeOfDay(sessionStart.getHours()),
        functionsUsed: sessionData.functionsUsed || []
      };
      
      // Store session pattern
      if (!this.dailyPatterns.has(userId)) {
        this.dailyPatterns.set(userId, {
          sessions: [],
          routines: []
        });
      }
      
      this.dailyPatterns.get(userId).sessions.push(sessionPattern);
      
      // Detect daily routines
      await this.detectDailyRoutines(userId);
      
    } catch (error) {
      console.error('Error analyzing session timing:', error);
    }
  }

  /**
   * Detect temporal patterns
   */
  async detectTemporalPatterns(userId, userData) {
    try {
      // Detect hourly patterns
      const hourlyPatterns = this.analyzeHourlyPatterns(userData.hourlyDistribution);
      
      // Detect daily patterns
      const dailyPatterns = this.analyzeDailyPatterns(userData.dailyDistribution);
      
      // Detect function-specific timing patterns
      const functionPatterns = this.analyzeFunctionTiming(userData.functionalTiming);
      
      // Detect peak usage times
      const peakTimes = this.detectPeakUsageTimes(userData);
      
      // Create comprehensive temporal pattern
      const temporalPattern = {
        userId: userId,
        patternId: `temporal_${userId}_${Date.now()}`,
        type: 'temporal',
        hourlyPatterns: hourlyPatterns,
        dailyPatterns: dailyPatterns,
        functionPatterns: functionPatterns,
        peakTimes: peakTimes,
        metadata: {
          totalEvents: userData.events.length,
          dateRange: this.getDateRange(userData.events),
          consistency: this.calculateConsistency(userData)
        }
      };
      
      // Check if pattern is significant
      if (this.isSignificantPattern(temporalPattern)) {
        // Emit pattern detected event
        await this.eventBus.emit(LEARNING_EVENTS.TEMPORAL_PATTERN_FOUND, temporalPattern);
        
        this.stats.patternsDetected++;
      }
      
    } catch (error) {
      console.error('Error detecting temporal patterns:', error);
    }
  }

  /**
   * Analyze hourly patterns
   */
  analyzeHourlyPatterns(hourlyDistribution) {
    const total = hourlyDistribution.reduce((sum, count) => sum + count, 0);
    if (total === 0) return null;
    
    const patterns = {
      distribution: hourlyDistribution.map(count => count / total),
      peakHours: [],
      quietHours: [],
      workingHours: { start: null, end: null }
    };
    
    // Find peak hours (top 3)
    const hourlyData = hourlyDistribution.map((count, hour) => ({ hour, count }));
    hourlyData.sort((a, b) => b.count - a.count);
    patterns.peakHours = hourlyData.slice(0, 3).map(d => d.hour);
    
    // Find quiet hours (bottom 3 with > 0 activity)
    const activeHours = hourlyData.filter(d => d.count > 0);
    patterns.quietHours = activeHours.slice(-3).map(d => d.hour);
    
    // Detect working hours pattern
    const workingHoursActivity = hourlyDistribution.slice(8, 18).reduce((sum, c) => sum + c, 0);
    const workingHoursRatio = workingHoursActivity / total;
    
    if (workingHoursRatio > 0.7) {
      patterns.workingHours = { start: 8, end: 18 };
    }
    
    return patterns;
  }

  /**
   * Analyze daily patterns
   */
  analyzeDailyPatterns(dailyDistribution) {
    const total = dailyDistribution.reduce((sum, count) => sum + count, 0);
    if (total === 0) return null;
    
    const patterns = {
      distribution: dailyDistribution.map(count => count / total),
      mostActiveDays: [],
      leastActiveDays: [],
      weekdayVsWeekend: null
    };
    
    // Find most active days
    const dailyData = dailyDistribution.map((count, day) => ({ day, count }));
    dailyData.sort((a, b) => b.count - a.count);
    patterns.mostActiveDays = dailyData.slice(0, 2).map(d => this.getDayName(d.day));
    patterns.leastActiveDays = dailyData.slice(-2).map(d => this.getDayName(d.day));
    
    // Analyze weekday vs weekend
    const weekdayActivity = [1, 2, 3, 4, 5].reduce((sum, day) => sum + dailyDistribution[day], 0);
    const weekendActivity = dailyDistribution[0] + dailyDistribution[6];
    
    patterns.weekdayVsWeekend = {
      weekdayRatio: weekdayActivity / total,
      weekendRatio: weekendActivity / total,
      preference: weekdayActivity > weekendActivity * 2 ? 'weekday' : 
                  weekendActivity > weekdayActivity * 2 ? 'weekend' : 'balanced'
    };
    
    return patterns;
  }

  /**
   * Analyze function timing patterns
   */
  analyzeFunctionTiming(functionalTiming) {
    const patterns = [];
    
    for (const [functionName, timing] of functionalTiming) {
      if (timing.times.length < 3) continue;
      
      // Find preferred time for this function
      const preferredHour = timing.preferredHours.indexOf(Math.max(...timing.preferredHours));
      const preferredDay = timing.preferredDays.indexOf(Math.max(...timing.preferredDays));
      
      patterns.push({
        functionName: functionName,
        preferredTime: {
          hour: preferredHour,
          timeOfDay: this.getTimeOfDay(preferredHour),
          dayOfWeek: this.getDayName(preferredDay)
        },
        frequency: timing.times.length,
        consistency: this.calculateTimingConsistency(timing)
      });
    }
    
    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Detect peak usage times
   */
  detectPeakUsageTimes(userData) {
    const peaks = [];
    
    // Analyze hourly peaks
    const hourlyPeaks = this.findPeaks(userData.hourlyDistribution);
    
    for (const peak of hourlyPeaks) {
      peaks.push({
        type: 'hourly',
        time: peak,
        description: `${peak}:00 - ${peak + 1}:00`,
        intensity: userData.hourlyDistribution[peak]
      });
    }
    
    // Analyze daily peaks
    const dailyPeaks = this.findPeaks(userData.dailyDistribution);
    
    for (const peak of dailyPeaks) {
      peaks.push({
        type: 'daily',
        day: this.getDayName(peak),
        intensity: userData.dailyDistribution[peak]
      });
    }
    
    return peaks;
  }

  /**
   * Detect daily routines
   */
  async detectDailyRoutines(userId) {
    const userPatterns = this.dailyPatterns.get(userId);
    if (!userPatterns || userPatterns.sessions.length < 10) return;
    
    // Group sessions by time of day
    const morningRoutines = userPatterns.sessions.filter(s => s.startHour >= 6 && s.startHour < 12);
    const afternoonRoutines = userPatterns.sessions.filter(s => s.startHour >= 12 && s.startHour < 18);
    const eveningRoutines = userPatterns.sessions.filter(s => s.startHour >= 18 && s.startHour < 24);
    
    // Analyze each time period for consistent patterns
    const routines = [];
    
    if (morningRoutines.length >= 5) {
      const morningPattern = this.extractRoutinePattern(morningRoutines);
      if (morningPattern) {
        routines.push({
          ...morningPattern,
          timeOfDay: 'morning',
          typicalStart: this.calculateAverageTime(morningRoutines.map(r => r.startHour))
        });
      }
    }
    
    if (afternoonRoutines.length >= 5) {
      const afternoonPattern = this.extractRoutinePattern(afternoonRoutines);
      if (afternoonPattern) {
        routines.push({
          ...afternoonPattern,
          timeOfDay: 'afternoon',
          typicalStart: this.calculateAverageTime(afternoonRoutines.map(r => r.startHour))
        });
      }
    }
    
    if (eveningRoutines.length >= 5) {
      const eveningPattern = this.extractRoutinePattern(eveningRoutines);
      if (eveningPattern) {
        routines.push({
          ...eveningPattern,
          timeOfDay: 'evening',
          typicalStart: this.calculateAverageTime(eveningRoutines.map(r => r.startHour))
        });
      }
    }
    
    if (routines.length > 0) {
      userPatterns.routines = routines;
      
      // Emit daily routine pattern
      await this.eventBus.emit('temporal.routine.detected', {
        userId: userId,
        routines: routines,
        confidence: this.calculateRoutineConfidence(routines)
      });
    }
  }

  /**
   * Extract routine pattern from sessions
   */
  extractRoutinePattern(sessions) {
    if (sessions.length < 3) return null;
    
    // Find common functions across sessions
    const functionFrequency = {};
    
    for (const session of sessions) {
      for (const func of session.functionsUsed) {
        functionFrequency[func] = (functionFrequency[func] || 0) + 1;
      }
    }
    
    // Functions that appear in > 60% of sessions are part of routine
    const threshold = sessions.length * 0.6;
    const routineFunctions = Object.entries(functionFrequency)
      .filter(([func, count]) => count >= threshold)
      .map(([func]) => func);
    
    if (routineFunctions.length === 0) return null;
    
    return {
      functions: routineFunctions,
      frequency: sessions.length,
      averageDuration: this.calculateAverageDuration(sessions)
    };
  }

  /**
   * Predict next action based on time
   */
  predictNextActionByTime(userId, currentTime = new Date()) {
    const userData = this.temporalData.get(userId);
    if (!userData) return null;
    
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    
    // Find functions commonly used at this time
    const predictions = [];
    
    for (const [functionName, timing] of userData.functionalTiming) {
      const hourScore = timing.preferredHours[hour] / Math.max(...timing.preferredHours);
      const dayScore = timing.preferredDays[dayOfWeek] / Math.max(...timing.preferredDays);
      
      if (hourScore > 0.5 || dayScore > 0.5) {
        predictions.push({
          functionName: functionName,
          confidence: (hourScore + dayScore) / 2,
          reason: `Commonly used at ${hour}:00 on ${this.getDayName(dayOfWeek)}`
        });
      }
    }
    
    return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Get user's typical schedule
   */
  getUserSchedule(userId) {
    const userData = this.temporalData.get(userId);
    if (!userData) return null;
    
    const patterns = this.dailyPatterns.get(userId);
    
    return {
      typicalStartTime: this.findTypicalStartTime(userData),
      typicalEndTime: this.findTypicalEndTime(userData),
      peakProductivityHours: this.findPeakProductivity(userData),
      dailyRoutines: patterns?.routines || [],
      weeklyPattern: this.analyzeDailyPatterns(userData.dailyDistribution)
    };
  }

  /**
   * Helper methods
   */
  getTimeOfDay(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  getDayName(dayIndex) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex] || 'Unknown';
  }

  isBusinessHours(timestamp) {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    return hour >= 8 && hour < 18 && day >= 1 && day <= 5;
  }

  findPeaks(distribution) {
    const peaks = [];
    const threshold = Math.max(...distribution) * 0.7;
    
    for (let i = 0; i < distribution.length; i++) {
      if (distribution[i] >= threshold) {
        peaks.push(i);
      }
    }
    
    return peaks;
  }

  calculateConsistency(userData) {
    // Calculate coefficient of variation for hourly distribution
    const mean = userData.hourlyDistribution.reduce((sum, c) => sum + c, 0) / 24;
    const variance = userData.hourlyDistribution.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / 24;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? 1 - (stdDev / mean) : 0;
  }

  calculateTimingConsistency(timing) {
    // Calculate how consistent the timing is
    const hourlyMax = Math.max(...timing.preferredHours);
    const hourlyTotal = timing.preferredHours.reduce((sum, c) => sum + c, 0);
    
    return hourlyMax / hourlyTotal;
  }

  calculateAverageTime(hours) {
    if (hours.length === 0) return 0;
    return Math.round(hours.reduce((sum, h) => sum + h, 0) / hours.length);
  }

  calculateAverageDuration(sessions) {
    if (sessions.length === 0) return 0;
    return sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
  }

  calculateRoutineConfidence(routines) {
    if (routines.length === 0) return 0;
    
    const avgFrequency = routines.reduce((sum, r) => sum + r.frequency, 0) / routines.length;
    return Math.min(1, avgFrequency / 20); // Max confidence at 20+ occurrences
  }

  getDateRange(events) {
    if (events.length === 0) return null;
    
    const timestamps = events.map(e => e.timestamp);
    return {
      start: new Date(Math.min(...timestamps)),
      end: new Date(Math.max(...timestamps))
    };
  }

  isSignificantPattern(pattern) {
    return pattern.metadata.totalEvents >= this.minOccurrences &&
           pattern.metadata.consistency >= this.trendThreshold;
  }

  findTypicalStartTime(userData) {
    // Find the first hour with significant activity
    for (let hour = 0; hour < 24; hour++) {
      if (userData.hourlyDistribution[hour] > 0) {
        return hour;
      }
    }
    return null;
  }

  findTypicalEndTime(userData) {
    // Find the last hour with significant activity
    for (let hour = 23; hour >= 0; hour--) {
      if (userData.hourlyDistribution[hour] > 0) {
        return hour;
      }
    }
    return null;
  }

  findPeakProductivity(userData) {
    // Find continuous hours with high activity
    const threshold = Math.max(...userData.hourlyDistribution) * 0.6;
    const peaks = [];
    
    for (let hour = 0; hour < 24; hour++) {
      if (userData.hourlyDistribution[hour] >= threshold) {
        peaks.push(hour);
      }
    }
    
    return peaks;
  }

  /**
   * Start temporal analysis interval
   */
  startTemporalAnalysis() {
    this.analysisInterval = setInterval(() => {
      this.performPeriodicAnalysis();
    }, 3600000); // Every hour
  }

  /**
   * Perform periodic temporal analysis
   */
  async performPeriodicAnalysis() {
    try {
      for (const [userId, userData] of this.temporalData) {
        if (userData.events.length >= this.minOccurrences) {
          await this.detectTemporalPatterns(userId, userData);
        }
      }
      
      this.stats.usersAnalyzed = this.temporalData.size;
      
    } catch (error) {
      console.error('Error in periodic temporal analysis:', error);
    }
  }

  /**
   * Get engine statistics
   */
  getStats() {
    return {
      ...this.stats,
      totalUsers: this.temporalData.size,
      totalDailyPatterns: this.dailyPatterns.size,
      totalWeeklyPatterns: this.weeklyPatterns.size
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    console.log('Temporal Pattern Engine shutdown complete');
  }
}

module.exports = new TemporalPatternEngine();