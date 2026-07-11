// Date Validation Utilities
// Provides date and time validation for AgentServiceV4

// Add service proxy getter
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class DateValidators {
    constructor() {
        this.serviceToken = null;
    }

    async initialize() {
        const proxy = getServiceProxy();
        const serviceAccountManager = proxy.getService('serviceAccountManager');
        this.serviceToken = await serviceAccountManager.authenticate('date-validators');
    }

    // Validate date string
    validateDateString(dateStr) {
        if (!dateStr) {
            throw new Error('Date is required');
        }
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format');
        }
        
        return true;
    }

    // Validate date is not in the future
    validateDateNotFuture(dateStr) {
        this.validateDateString(dateStr);
        
        const date = new Date(dateStr);
        const now = new Date();
        
        if (date > now) {
            throw new Error('Date cannot be in the future');
        }
        
        return true;
    }

    // Validate date is not too far in the past
    validateDateNotTooOld(dateStr, maxYearsAgo = 150) {
        this.validateDateString(dateStr);
        
        const date = new Date(dateStr);
        const now = new Date();
        const maxAgoDate = new Date(now.getFullYear() - maxYearsAgo, now.getMonth(), now.getDate());
        
        if (date < maxAgoDate) {
            throw new Error(`Date cannot be more than ${maxYearsAgo} years ago`);
        }
        
        return true;
    }

    // Validate birth date
    validateBirthDate(dateStr) {
        this.validateDateString(dateStr);
        this.validateDateNotFuture(dateStr);
        this.validateDateNotTooOld(dateStr, 150);
        
        return true;
    }

    // Validate appointment date
    validateAppointmentDate(dateStr) {
        this.validateDateString(dateStr);
        
        const appointmentDate = new Date(dateStr);
        const now = new Date();
        const maxFuture = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
        
        // Allow past dates for historical appointments
        const minPast = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        
        if (appointmentDate > maxFuture) {
            throw new Error('Appointment date cannot be more than 2 years in the future');
        }
        
        if (appointmentDate < minPast) {
            throw new Error('Appointment date cannot be more than 5 years in the past');
        }
        
        return true;
    }

    // Validate time string (HH:MM format)
    validateTimeString(timeStr) {
        if (!timeStr) {
            throw new Error('Time is required');
        }
        
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(timeStr)) {
            throw new Error('Time must be in HH:MM format (24-hour)');
        }
        
        return true;
    }

    // Validate business hours
    validateBusinessHours(timeStr) {
        this.validateTimeString(timeStr);
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        const timeInMinutes = hours * 60 + minutes;
        
        // Typical business hours: 6:00 AM to 10:00 PM
        const startTime = 6 * 60; // 6:00 AM
        const endTime = 22 * 60; // 10:00 PM
        
        if (timeInMinutes < startTime || timeInMinutes > endTime) {
            throw new Error('Time must be within business hours (06:00 - 22:00)');
        }
        
        return true;
    }

    // Validate date range
    validateDateRange(startDate, endDate) {
        this.validateDateString(startDate);
        this.validateDateString(endDate);
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
            throw new Error('Start date must be before end date');
        }
        
        return true;
    }

    // Validate medication duration
    validateMedicationDuration(startDate, endDate) {
        this.validateDateRange(startDate, endDate);
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = (end - start) / (1000 * 60 * 60 * 24);
        
        if (diffDays > 365) {
            throw new Error('Medication duration cannot exceed 1 year');
        }
        
        if (diffDays < 1) {
            throw new Error('Medication duration must be at least 1 day');
        }
        
        return true;
    }

    // Validate age from birth date
    validateAgeFromBirthDate(birthDate, minAge = 0, maxAge = 150) {
        this.validateBirthDate(birthDate);
        
        const birth = new Date(birthDate);
        const today = new Date();
        
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        if (age < minAge || age > maxAge) {
            throw new Error(`Age must be between ${minAge} and ${maxAge} years`);
        }
        
        return true;
    }

    // Validate ISO 8601 date format
    validateISO8601Date(dateStr) {
        if (!dateStr) {
            throw new Error('ISO date is required');
        }
        
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
        if (!iso8601Regex.test(dateStr)) {
            throw new Error('Date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
        }
        
        // Also validate it's a valid date
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid ISO 8601 date');
        }
        
        return true;
    }

    // Validate timezone
    validateTimezone(timezone) {
        if (!timezone) {
            throw new Error('Timezone is required');
        }
        
        try {
            // Try to create a date with the timezone
            new Intl.DateTimeFormat('en-US', { timeZone: timezone });
            return true;
        } catch (error) {
            throw new Error('Invalid timezone');
        }
    }

    // Validate recurring pattern
    validateRecurringPattern(pattern) {
        if (!pattern) {
            throw new Error('Recurring pattern is required');
        }
        
        const validPatterns = [
            'daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly',
            'weekdays', 'weekends', 'custom'
        ];
        
        if (!validPatterns.includes(pattern.toLowerCase())) {
            throw new Error(`Invalid recurring pattern. Must be one of: ${validPatterns.join(', ')}`);
        }
        
        return true;
    }

    // Validate appointment duration
    validateAppointmentDuration(durationMinutes) {
        const duration = parseInt(durationMinutes);
        
        if (isNaN(duration) || duration <= 0) {
            throw new Error('Duration must be a positive number');
        }
        
        if (duration < 5) {
            throw new Error('Appointment duration must be at least 5 minutes');
        }
        
        if (duration > 480) { // 8 hours
            throw new Error('Appointment duration cannot exceed 8 hours');
        }
        
        // Should be in 5-minute increments
        if (duration % 5 !== 0) {
            throw new Error('Appointment duration must be in 5-minute increments');
        }
        
        return true;
    }
}

// Create and export singleton
const dateValidators = new DateValidators();

// Register with service proxy
if (typeof module !== 'undefined' && module.exports) {
    const proxy = getServiceProxy();
    proxy.registerService('dateValidators', () => dateValidators);
}

module.exports = dateValidators;