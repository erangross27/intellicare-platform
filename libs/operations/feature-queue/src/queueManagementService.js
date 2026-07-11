const serviceAccountManager = require('../../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../../backend/services/secureDataAccess');

// Queue Management Service for IntelliCare
// Handles queue numbers for appointments and walk-ins

class QueueManagementService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    // Store current queue numbers per practice and date
    this.queues = new Map(); // Format: "practiceId:date:providerId" -> queue data
    this.dailyCounters = new Map(); // Format: "practiceId:date" -> counter
  }

  async initialize() {
    if (this.initialized) return;
    this.serviceToken = await serviceAccountManager.authenticate('queue-management-service');
    this.initialized = true;
    return this;
  }

  /**
   * Get service context for SecureDataAccess operations
   */
  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'queue-management-service',
      operation: 'database-access',
      practiceId: practiceId
    };
  }

  // Generate queue key
  getQueueKey(practiceId, date, providerId = 'general') {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return `${practiceId}:${dateStr}:${providerId}`;
  }

  // Get daily counter key
  getCounterKey(practiceId, date) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return `${practiceId}:${dateStr}`;
  }

  // Initialize queue for a day if not exists
  initializeQueue(practiceId, date, providerId = 'general') {
    const queueKey = this.getQueueKey(practiceId, date, providerId);
    
    if (!this.queues.has(queueKey)) {
      this.queues.set(queueKey, {
        scheduled: [],      // Patients with appointments
        walkIns: [],       // Walk-in patients
        currentNumber: 0,  // Current serving number
        lastIssuedScheduled: 0,  // Last issued number for scheduled
        lastIssuedWalkIn: 1000,  // Walk-ins start from 1000
        servedToday: []    // Already served patients
      });
    }
    
    return this.queues.get(queueKey);
  }

  // Issue a queue number for scheduled appointment
  async issueScheduledNumber(practiceId, date, providerId, patientId, appointmentId) {
    const queue = this.initializeQueue(practiceId, date, providerId);
    
    // Check if patient already has a number
    const existing = queue.scheduled.find(item => item.patientId === patientId);
    if (existing) {
      return {
        success: true,
        queueNumber: existing.queueNumber,
        position: queue.scheduled.indexOf(existing) + 1,
        estimatedWaitTime: this.calculateWaitTime(queue, existing.queueNumber),
        isExisting: true
      };
    }

    // Issue new number for scheduled patient
    queue.lastIssuedScheduled++;
    const queueNumber = queue.lastIssuedScheduled;
    
    const queueItem = {
      queueNumber,
      patientId,
      appointmentId,
      type: 'scheduled',
      issuedAt: new Date(),
      status: 'waiting',
      checkInTime: null
    };
    
    // Insert in order
    queue.scheduled.push(queueItem);
    queue.scheduled.sort((a, b) => a.queueNumber - b.queueNumber);
    
    return {
      success: true,
      queueNumber,
      position: queue.scheduled.indexOf(queueItem) + 1,
      estimatedWaitTime: this.calculateWaitTime(queue, queueNumber),
      message: `Queue number ${queueNumber} issued for scheduled appointment`
    };
  }

  // Issue a queue number for walk-in patient
  async issueWalkInNumber(practiceId, date, providerId, patientId) {
    const queue = this.initializeQueue(practiceId, date, providerId);
    
    // Check if patient already has a number
    const existing = queue.walkIns.find(item => item.patientId === patientId);
    if (existing) {
      return {
        success: true,
        queueNumber: existing.queueNumber,
        position: this.getWalkInPosition(queue, existing.queueNumber),
        estimatedWaitTime: this.calculateWaitTime(queue, existing.queueNumber),
        isExisting: true
      };
    }

    // Issue new number for walk-in (starting from 1000)
    queue.lastIssuedWalkIn++;
    const queueNumber = queue.lastIssuedWalkIn;
    
    const queueItem = {
      queueNumber,
      patientId,
      type: 'walkIn',
      issuedAt: new Date(),
      status: 'waiting',
      checkInTime: new Date()  // Walk-ins check in immediately
    };
    
    queue.walkIns.push(queueItem);
    
    return {
      success: true,
      queueNumber,
      position: this.getWalkInPosition(queue, queueNumber),
      estimatedWaitTime: this.calculateWaitTime(queue, queueNumber),
      message: `Walk-in queue number ${queueNumber} issued`
    };
  }

  // Patient checks in with their appointment
  async checkIn(practiceId, date, providerId, patientId, appointmentId = null) {
    const queue = this.initializeQueue(practiceId, date, providerId);
    
    // Find if patient has scheduled appointment
    const scheduled = queue.scheduled.find(item => 
      item.patientId === patientId || item.appointmentId === appointmentId
    );
    
    if (scheduled) {
      // Patient has appointment - give them their scheduled number
      if (!scheduled.checkInTime) {
        scheduled.checkInTime = new Date();
        scheduled.status = 'checkedIn';
      }
      
      return {
        success: true,
        queueNumber: scheduled.queueNumber,
        type: 'scheduled',
        position: this.getPosition(queue, scheduled.queueNumber),
        estimatedWaitTime: this.calculateWaitTime(queue, scheduled.queueNumber),
        message: `Checked in with queue number ${scheduled.queueNumber}`
      };
    } else {
      // No appointment - issue walk-in number
      return await this.issueWalkInNumber(practiceId, date, providerId, patientId);
    }
  }

  // Get current position in queue
  getPosition(queue, queueNumber) {
    // Scheduled patients have priority
    const scheduledPosition = queue.scheduled.findIndex(item => 
      item.queueNumber === queueNumber && item.status !== 'served'
    );
    
    if (scheduledPosition !== -1) {
      return scheduledPosition + 1;
    }
    
    // Walk-ins come after all scheduled
    const activeScheduled = queue.scheduled.filter(item => item.status !== 'served').length;
    const walkInPosition = queue.walkIns.findIndex(item => 
      item.queueNumber === queueNumber && item.status !== 'served'
    );
    
    if (walkInPosition !== -1) {
      return activeScheduled + walkInPosition + 1;
    }
    
    return -1;  // Not in queue
  }

  // Get walk-in position (after scheduled patients)
  getWalkInPosition(queue, queueNumber) {
    const activeScheduled = queue.scheduled.filter(item => 
      item.status !== 'served' && item.checkInTime
    ).length;
    
    const walkInIndex = queue.walkIns.findIndex(item => 
      item.queueNumber === queueNumber && item.status !== 'served'
    );
    
    return walkInIndex !== -1 ? activeScheduled + walkInIndex + 1 : -1;
  }

  // Calculate estimated wait time
  calculateWaitTime(queue, queueNumber) {
    const position = this.getPosition(queue, queueNumber);
    if (position <= 0) return 0;
    
    // Assume average 15 minutes per patient
    const avgTimePerPatient = 15;
    return (position - 1) * avgTimePerPatient;
  }

  // Call next patient
  async callNext(practiceId, date, providerId) {
    const queue = this.initializeQueue(practiceId, date, providerId);
    
    // First check scheduled patients who have checked in
    const nextScheduled = queue.scheduled.find(item => 
      item.status === 'checkedIn'
    );
    
    if (nextScheduled) {
      nextScheduled.status = 'called';
      queue.currentNumber = nextScheduled.queueNumber;
      return {
        success: true,
        queueNumber: nextScheduled.queueNumber,
        patientId: nextScheduled.patientId,
        type: 'scheduled',
        message: `Calling patient number ${nextScheduled.queueNumber} (scheduled)`
      };
    }
    
    // Then check walk-ins
    const nextWalkIn = queue.walkIns.find(item => 
      item.status === 'waiting' || item.status === 'checkedIn'
    );
    
    if (nextWalkIn) {
      nextWalkIn.status = 'called';
      queue.currentNumber = nextWalkIn.queueNumber;
      return {
        success: true,
        queueNumber: nextWalkIn.queueNumber,
        patientId: nextWalkIn.patientId,
        type: 'walkIn',
        message: `Calling patient number ${nextWalkIn.queueNumber} (walk-in)`
      };
    }
    
    return {
      success: false,
      message: 'No patients waiting'
    };
  }

  // Mark patient as served
  async markServed(practiceId, date, providerId, queueNumber) {
    const queue = this.initializeQueue(practiceId, date, providerId);
    
    // Find in scheduled
    const scheduled = queue.scheduled.find(item => item.queueNumber === queueNumber);
    if (scheduled) {
      scheduled.status = 'served';
      scheduled.servedAt = new Date();
      queue.servedToday.push(scheduled);
      return { success: true, message: `Patient ${queueNumber} marked as served` };
    }
    
    // Find in walk-ins
    const walkIn = queue.walkIns.find(item => item.queueNumber === queueNumber);
    if (walkIn) {
      walkIn.status = 'served';
      walkIn.servedAt = new Date();
      queue.servedToday.push(walkIn);
      return { success: true, message: `Patient ${queueNumber} marked as served` };
    }
    
    return { success: false, message: `Queue number ${queueNumber} not found` };
  }

  // Get queue status
  async getQueueStatus(practiceId, date, providerId) {
    const queue = this.initializeQueue(practiceId, date, providerId);
    
    const waitingScheduled = queue.scheduled.filter(item => 
      item.status === 'waiting' || item.status === 'checkedIn'
    );
    
    const waitingWalkIns = queue.walkIns.filter(item => 
      item.status === 'waiting' || item.status === 'checkedIn'
    );
    
    return {
      currentServing: queue.currentNumber,
      scheduledWaiting: waitingScheduled.length,
      walkInsWaiting: waitingWalkIns.length,
      totalWaiting: waitingScheduled.length + waitingWalkIns.length,
      servedToday: queue.servedToday.length,
      nextScheduled: waitingScheduled[0]?.queueNumber || null,
      nextWalkIn: waitingWalkIns[0]?.queueNumber || null,
      estimatedWaitTime: {
        scheduled: this.calculateWaitTime(queue, waitingScheduled[0]?.queueNumber),
        walkIn: this.calculateWaitTime(queue, waitingWalkIns[0]?.queueNumber)
      }
    };
  }

  // Generate display number for appointment (used when booking)
  async generateAppointmentNumber(practiceId, date) {
    const counterKey = this.getCounterKey(practiceId, date);
    
    // Format: YYYYMMDD-NNNN (e.g., 20250825-0001)
    const dateStr = typeof date === 'string' ? 
      date.replace(/-/g, '') : 
      date.toISOString().split('T')[0].replace(/-/g, '');
    
    // Check database for highest existing number using SecureDataAccess
    try {
      const context = this.getServiceContext(practiceId);
      
      // Create pattern for today's appointments
      const pattern = `^${dateStr}-`;
      
      // Query for appointments with numbers starting with today's date
      const appointments = await SecureDataAccess.query(
        'appointments',
        { 
          appointmentNumber: { $regex: pattern }
        },
        { 
          sort: { appointmentNumber: -1 },
          limit: 1,
          projection: { appointmentNumber: 1 }
        },
        context
      );
      
      let counter = 0;
      if (appointments && appointments.length > 0 && appointments[0].appointmentNumber) {
        // Extract the counter from the last appointment number
        const parts = appointments[0].appointmentNumber.split('-');
        if (parts.length === 2) {
          counter = parseInt(parts[1], 10) || 0;
        }
      }
      
      // Increment for new appointment
      counter++;
      
      // Update memory cache
      this.dailyCounters.set(counterKey, counter);
      
      const paddedNumber = counter.toString().padStart(4, '0');
      return `${dateStr}-${paddedNumber}`;
    } catch (error) {
      console.error('Error checking existing appointment numbers:', error);
      
      // Fallback: Use memory-based counter
      let counter = this.dailyCounters.get(counterKey) || 0;
      counter++;
      this.dailyCounters.set(counterKey, counter);
      
      const paddedNumber = counter.toString().padStart(4, '0');
      return `${dateStr}-${paddedNumber}`;
    }
  }

  // Reset daily counters (should be called at midnight)
  resetDailyCounters() {
    this.queues.clear();
    this.dailyCounters.clear();
  }

  // Get patient's queue info
  async getPatientQueueInfo(practiceId, date, providerId, patientId) {
    const queue = this.initializeQueue(practiceId, date, providerId);
    
    // Check scheduled
    const scheduled = queue.scheduled.find(item => item.patientId === patientId);
    if (scheduled) {
      return {
        found: true,
        queueNumber: scheduled.queueNumber,
        type: 'scheduled',
        status: scheduled.status,
        position: this.getPosition(queue, scheduled.queueNumber),
        estimatedWaitTime: this.calculateWaitTime(queue, scheduled.queueNumber),
        checkInTime: scheduled.checkInTime
      };
    }
    
    // Check walk-ins
    const walkIn = queue.walkIns.find(item => item.patientId === patientId);
    if (walkIn) {
      return {
        found: true,
        queueNumber: walkIn.queueNumber,
        type: 'walkIn',
        status: walkIn.status,
        position: this.getWalkInPosition(queue, walkIn.queueNumber),
        estimatedWaitTime: this.calculateWaitTime(queue, walkIn.queueNumber),
        checkInTime: walkIn.checkInTime
      };
    }
    
    return { found: false };
  }
}

// Export singleton
module.exports = new QueueManagementService();