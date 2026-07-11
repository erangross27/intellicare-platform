const mongoose = require('mongoose');
const SecureDataAccess = require('../services/secureDataAccess');

const providerScheduleSchema = new mongoose.Schema({
  providerId: {
    type: String,
    required: true,
    index: true
  },
  providerName: {
    type: String,
    required: true
  },
  practiceId: {
    type: String,
    required: true,
    index: true
  },
  
  // Regular working hours (weekly schedule)
  workingHours: {
    sunday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      breakStart: { type: String, default: '12:00' },
      breakEnd: { type: String, default: '13:00' }
    },
    monday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      breakStart: { type: String, default: '12:00' },
      breakEnd: { type: String, default: '13:00' }
    },
    tuesday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      breakStart: { type: String, default: '12:00' },
      breakEnd: { type: String, default: '13:00' }
    },
    wednesday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      breakStart: { type: String, default: '12:00' },
      breakEnd: { type: String, default: '13:00' }
    },
    thursday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '17:00' },
      breakStart: { type: String, default: '12:00' },
      breakEnd: { type: String, default: '13:00' }
    },
    friday: {
      isWorking: { type: Boolean, default: false },
      startTime: { type: String, default: '09:00' },
      endTime: { type: String, default: '12:00' },
      breakStart: { type: String, default: null },
      breakEnd: { type: String, default: null }
    },
    saturday: {
      isWorking: { type: Boolean, default: false },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null },
      breakStart: { type: String, default: null },
      breakEnd: { type: String, default: null }
    }
  },
  
  // Default appointment duration in minutes
  defaultAppointmentDuration: {
    type: Number,
    default: 30
  },
  
  // Special dates (holidays, vacations, etc.)
  blockedDates: [{
    date: Date,
    reason: String,
    fullDay: { type: Boolean, default: true },
    startTime: String,
    endTime: String
  }],
  
  // Override schedule for specific dates
  specialSchedules: [{
    date: Date,
    startTime: String,
    endTime: String,
    breakStart: String,
    breakEnd: String
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
providerScheduleSchema.index({ providerId: 1, practiceId: 1 });
providerScheduleSchema.index({ 'blockedDates.date': 1 });
providerScheduleSchema.index({ 'specialSchedules.date': 1 });

// Method to check if provider is available at a specific time
providerScheduleSchema.methods.isAvailable = function(date, time, duration = 30) {
  const checkDate = new Date(date);
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][checkDate.getDay()];
  
  // Check if it's a blocked date
  const isBlocked = this.blockedDates.some(blocked => {
    const blockedDate = new Date(blocked.date);
    return blockedDate.toDateString() === checkDate.toDateString() &&
           (blocked.fullDay || (time >= blocked.startTime && time <= blocked.endTime));
  });
  
  if (isBlocked) return false;
  
  // Check special schedule for this date
  const specialSchedule = this.specialSchedules.find(special => {
    const specialDate = new Date(special.date);
    return specialDate.toDateString() === checkDate.toDateString();
  });
  
  let schedule;
  if (specialSchedule) {
    schedule = specialSchedule;
  } else {
    schedule = this.workingHours[dayOfWeek];
    if (!schedule.isWorking) return false;
  }
  
  // Check if time is within working hours
  if (time < schedule.startTime || time >= schedule.endTime) return false;
  
  // Check if time is during break
  if (schedule.breakStart && schedule.breakEnd) {
    const appointmentEnd = addMinutes(time, duration);
    if ((time >= schedule.breakStart && time < schedule.breakEnd) ||
        (appointmentEnd > schedule.breakStart && appointmentEnd <= schedule.breakEnd)) {
      return false;
    }
  }
  
  return true;
};

// Helper function to add minutes to time string
function addMinutes(time, minutes) {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

// Static method to get available slots for a date
providerScheduleSchema.statics.getAvailableSlots = async function(providerId, date, duration = 30, practiceId) {
  const SecureDataAccess = require('../services/secureDataAccess');
  const context = {
    serviceId: 'provider-schedule-model',
    operation: 'getAvailableSlots',
    practiceId: practiceId
  };
  const schedules = await SecureDataAccess.query('providerschedules', { providerId, practiceId }, { limit: 1 }, context);
  const schedule = schedules[0];
  
  if (!schedule) {
    // If no schedule exists, create default schedule
    return generateDefaultSlots(date, duration);
  }
  
  const slots = [];
  const checkDate = new Date(date);
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][checkDate.getDay()];
  
  // Check if it's a blocked date
  const blockedDate = schedule.blockedDates.find(blocked => {
    const bDate = new Date(blocked.date);
    return bDate.toDateString() === checkDate.toDateString();
  });
  
  if (blockedDate && blockedDate.fullDay) {
    return []; // No slots available on fully blocked days
  }
  
  // Get schedule for this day
  const specialSchedule = schedule.specialSchedules.find(special => {
    const sDate = new Date(special.date);
    return sDate.toDateString() === checkDate.toDateString();
  });
  
  let daySchedule;
  if (specialSchedule) {
    daySchedule = specialSchedule;
  } else {
    daySchedule = schedule.workingHours[dayOfWeek];
    if (!daySchedule.isWorking) return [];
  }
  
  // Generate time slots
  let currentTime = daySchedule.startTime;
  while (currentTime < daySchedule.endTime) {
    // Skip break time
    if (daySchedule.breakStart && daySchedule.breakEnd) {
      if (currentTime >= daySchedule.breakStart && currentTime < daySchedule.breakEnd) {
        currentTime = daySchedule.breakEnd;
        continue;
      }
    }
    
    // Skip partially blocked times
    if (blockedDate && !blockedDate.fullDay) {
      if (currentTime >= blockedDate.startTime && currentTime < blockedDate.endTime) {
        currentTime = addMinutes(currentTime, duration);
        continue;
      }
    }
    
    slots.push({
      time: currentTime,
      available: true,
      duration: duration
    });
    
    currentTime = addMinutes(currentTime, duration);
  }
  
  return slots;
};

function generateDefaultSlots(date, duration) {
  const slots = [];
  const checkDate = new Date(date);
  const dayOfWeek = checkDate.getDay();
  
  // No appointments on Saturday (Shabbat in Israel)
  if (dayOfWeek === 6) return [];
  
  // Friday - shorter hours
  if (dayOfWeek === 5) {
    let time = '09:00';
    while (time < '12:00') {
      slots.push({ time, available: true, duration });
      time = addMinutes(time, duration);
    }
    return slots;
  }
  
  // Regular weekdays
  let time = '09:00';
  while (time < '17:00') {
    // Skip lunch break
    if (time >= '12:00' && time < '13:00') {
      time = '13:00';
      continue;
    }
    slots.push({ time, available: true, duration });
    time = addMinutes(time, duration);
  }
  
  return slots;
}

module.exports = providerScheduleSchema;