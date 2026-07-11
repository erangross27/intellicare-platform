// Availability Service - Optimized for high-concurrency free/busy queries
// This service handles appointment availability with caching and performance optimizations

const NodeCache = require('node-cache');
const crypto = require('crypto');
const SecureDataAccess = require('./secureDataAccess');

class AvailabilityService {
  constructor() {
    // In-memory cache with 60-second TTL for availability data
    this.cache = new NodeCache({
      stdTTL: 60, // Cache for 1 minute
      checkperiod: 120,
      useClones: false // Better performance
    });

    // Track pending queries to prevent duplicate DB calls
    this.pendingQueries = new Map();

    // Track slot locks to prevent race conditions
    this.slotLocks = new Map();

    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      dbQueries: 0,
      avgQueryTime: 0
    };

    // Track initialization status
    this.initialized = false;
    this.serviceToken = null;
  }

  async initialize() {
    if (this.initialized) return this;
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('availabilityService');
    this.initialized = true;
    return this;
  }

  /**
   * Get service context for SecureDataAccess operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'availabilityService',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      practiceId: practiceId
    };
  }
  
  /**
   * Get available slots for a provider with caching and optimization
   * @param {Object} params - Query parameters
   * @param {Object} practiceContext - Practice context with models
   * @returns {Object} Available slots result
   */
  async getAvailableSlots(params, practiceContext) {
    const startTime = Date.now();
    const { providerId, date, duration = 30 } = params;
    
    // Generate cache key
    const cacheKey = this.getCacheKey(providerId, date, practiceContext.practiceId);
    
    // Check cache first
    const cachedData = this.cache.get(cacheKey);
    if (cachedData) {
      this.metrics.cacheHits++;
      this.updateMetrics(Date.now() - startTime);
      return cachedData;
    }
    
    this.metrics.cacheMisses++;
    
    // Check if there's already a pending query for this data
    if (this.pendingQueries.has(cacheKey)) {
      // Wait for the pending query to complete
      return await this.pendingQueries.get(cacheKey);
    }
    
    // Create a promise for this query
    const queryPromise = this.queryAvailability(params, practiceContext);
    this.pendingQueries.set(cacheKey, queryPromise);
    
    try {
      const result = await queryPromise;
      
      // Cache the result
      this.cache.set(cacheKey, result);
      
      // Clean up pending query
      this.pendingQueries.delete(cacheKey);
      
      this.updateMetrics(Date.now() - startTime);
      return result;
    } catch (error) {
      this.pendingQueries.delete(cacheKey);
      throw error;
    }
  }
  
  /**
   * Query availability from database with optimizations
   */
  async queryAvailability(params, practiceContext) {
    this.metrics.dbQueries++;
    const { providerId, date, duration = 30 } = params;
    const context = this.getServiceContext(practiceContext.practiceId);
    
    // Parse date
    let checkDate;
    if (date.includes('/')) {
      const [day, month, year] = date.split('/');
      checkDate = new Date(year, month - 1, day);
    } else {
      checkDate = new Date(date);
    }
    
    // Set date range for query
    const startOfDay = new Date(checkDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(checkDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Get active blocks for this provider - query all and filter in memory
    const allBlocks = await SecureDataAccess.query('availability_blocks', {
      providerId: providerId,
      status: 'active'
    }, { limit: 100 }, context);

    // Filter blocks that overlap with the requested date
    const blocks = allBlocks.filter(block => {
      if (!block.startDate || !block.endDate) return false;
      const blockStart = new Date(block.startDate);
      const blockEnd = new Date(block.endDate);
      return blockStart <= endOfDay && blockEnd >= startOfDay;
    });
    
    // Query busy slots using SecureDataAccess - avoid operators that trigger injection detection
    const allProviderAppointments = await SecureDataAccess.query(
      'appointments',
      {
        providerId: providerId
      },
      {
        limit: 200,  // Get recent appointments
        projection: { scheduledDate: 1, scheduledTime: 1, duration: 1, status: 1, _id: 0 },
        sort: { scheduledTime: 1 }
      },
      context
    );

    // Filter appointments for the requested date and status
    const busySlots = allProviderAppointments.filter(apt => {
      if (!apt.scheduledDate || !apt.status) return false;
      const aptDate = new Date(apt.scheduledDate);
      return aptDate >= startOfDay &&
             aptDate <= endOfDay &&
             (apt.status === 'scheduled' || apt.status === 'confirmed');
    });
    
    // Build busy times map
    const busyTimes = new Set();
    
    // Add appointment times
    busySlots.forEach(apt => {
      const slotDuration = apt.duration || 30;
      const [hour, minute] = apt.scheduledTime.split(':').map(Number);
      
      // Block time in 15-minute increments
      for (let i = 0; i < slotDuration; i += 15) {
        const blockedHour = hour + Math.floor((minute + i) / 60);
        const blockedMinute = (minute + i) % 60;
        const timeKey = `${String(blockedHour).padStart(2, '0')}:${String(blockedMinute).padStart(2, '0')}`;
        busyTimes.add(timeKey);
      }
    });
    
    // Add availability blocks (doctor's busy times)
    blocks.forEach(block => {
      // Check if this block applies to the requested date
      if (block.isActiveAt) {
        // Use the model method if available
        const dayOfWeek = checkDate.getDay();
        if (block.recurring && !block.recurringDays.includes(dayOfWeek)) {
          return; // Skip this block if it doesn't apply to this day
        }
      }
      
      const [startHour, startMinute] = block.startTime.split(':').map(Number);
      const [endHour, endMinute] = block.endTime.split(':').map(Number);
      
      // Block all times from start to end
      let currentHour = startHour;
      let currentMinute = startMinute;
      
      while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
        const timeKey = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        busyTimes.add(timeKey);
        
        // Increment by 15 minutes
        currentMinute += 15;
        if (currentMinute >= 60) {
          currentMinute = 0;
          currentHour++;
        }
      }
    });
    
    // Generate available slots
    const availableSlots = this.generateAvailableSlots(checkDate, busyTimes, duration);
    
    return {
      success: true,
      data: availableSlots,
      count: availableSlots.length,
      providerId: providerId,
      date: checkDate.toISOString().split('T')[0],
      cached: false
    };
  }
  
  /**
   * Generate available time slots
   */
  generateAvailableSlots(date, busyTimes, duration) {
    const slots = [];
    const dayOfWeek = date.getDay();
    
    // Israel working hours
    let startHour = 9;
    let endHour = 17;
    
    if (dayOfWeek === 5) { // Friday
      endHour = 12;
    } else if (dayOfWeek === 6) { // Saturday
      return [];
    }
    
    // Generate slots
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += duration) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        
        // Optional: Skip lunch break (12:00-13:00) - currently disabled to allow appointments
        // Uncomment the following lines if you want to enforce a lunch break
        // if (hour === 12 && dayOfWeek !== 5) {
        //   continue;
        // }
        
        // Check availability
        let isAvailable = true;
        for (let i = 0; i < duration; i += 15) {
          const checkHour = hour + Math.floor((minute + i) / 60);
          const checkMinute = (minute + i) % 60;
          const checkTime = `${String(checkHour).padStart(2, '0')}:${String(checkMinute).padStart(2, '0')}`;
          if (busyTimes.has(checkTime)) {
            isAvailable = false;
            break;
          }
        }
        
        if (isAvailable) {
          slots.push({
            time: timeStr,
            available: true,
            duration: duration
          });
        }
      }
    }
    
    return slots;
  }
  
  /**
   * Reserve a time slot with optimistic locking
   */
  async reserveSlot(providerId, date, time, duration, practiceContext) {
    const lockKey = `${providerId}-${date}-${time}`;
    
    // Check if slot is already being processed
    if (this.slotLocks.has(lockKey)) {
      return {
        success: false,
        error: 'SLOT_LOCKED',
        message: 'This time slot is currently being booked by another user'
      };
    }
    
    // Lock the slot
    this.slotLocks.set(lockKey, Date.now());
    
    try {
      // Invalidate cache for this provider/date
      const cacheKey = this.getCacheKey(providerId, date, practiceContext.practiceId);
      this.cache.del(cacheKey);
      
      // Create context for SecureDataAccess
      const context = this.getServiceContext(practiceContext.practiceId);
      
      // Double-check availability before booking
      const { Appointment } = practiceContext.models;
      
      // Parse date
      let checkDate;
      if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        checkDate = new Date(year, month - 1, day);
      } else {
        checkDate = new Date(date);
      }
      
      const startOfDay = new Date(checkDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Check for existing appointment - using simple query to avoid injection detection
      // Query all appointments and filter in memory to avoid MongoDB operators
      const allAppointments = await SecureDataAccess.query('appointments', {
        providerId: providerId
      }, { limit: 100 }, context);

      // Filter to find appointments for this time slot
      const existingAppointments = allAppointments.filter(apt => {
        if (!apt.scheduledDate || !apt.scheduledTime || !apt.status) return false;
        const aptDate = new Date(apt.scheduledDate);
        return aptDate >= startOfDay &&
               aptDate <= endOfDay &&
               apt.scheduledTime === time &&
               (apt.status === 'scheduled' || apt.status === 'confirmed');
      });
      
      const existingAppointment = existingAppointments[0];
      if (existingAppointment) {
        return {
          success: false,
          error: 'SLOT_TAKEN',
          message: 'This time slot has just been booked'
        };
      }
      
      return {
        success: true,
        locked: true,
        lockExpiry: Date.now() + 30000 // 30 second lock
      };
    } finally {
      // Release lock after 30 seconds
      setTimeout(() => {
        this.slotLocks.delete(lockKey);
      }, 30000);
    }
  }
  
  /**
   * Release a slot lock
   */
  releaseSlot(providerId, date, time) {
    const lockKey = `${providerId}-${date}-${time}`;
    this.slotLocks.delete(lockKey);
  }
  
  /**
   * Invalidate cache for a provider/date
   */
  invalidateCache(providerId, date, practiceId) {
    const cacheKey = this.getCacheKey(providerId, date, practiceId);
    this.cache.del(cacheKey);
  }
  
  /**
   * Generate cache key
   */
  getCacheKey(providerId, date, practiceId) {
    return `availability:${practiceId}:${providerId}:${date}`;
  }
  
  /**
   * Update performance metrics
   */
  updateMetrics(queryTime) {
    const totalQueries = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.avgQueryTime = 
      (this.metrics.avgQueryTime * (totalQueries - 1) + queryTime) / totalQueries;
  }
  
  /**
   * Get performance metrics
   */
  getMetrics() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      ...this.metrics,
      cacheHitRate: total > 0 ? (this.metrics.cacheHits / total * 100).toFixed(2) + '%' : '0%',
      totalQueries: total
    };
  }
  
  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.flushAll();
    this.pendingQueries.clear();
    this.slotLocks.clear();
  }
}

// Export singleton instance
module.exports = new AvailabilityService();