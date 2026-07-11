/**
 * Queue Management Service
 * Handles appointment numbering and queue management
 */

class QueueManagementService {
  constructor() {
    this.initialized = false;
    this.appointmentCounters = new Map(); // Track appointment numbers per practice per day
  }

  async initialize() {
    this.initialized = true;
    console.log('✅ Queue Management Service initialized');
    return true;
  }

  /**
   * Generate a unique appointment number for the day
   * Format: YYYYMMDD-XXX (e.g., 20250919-001)
   */
  async generateAppointmentNumber(practiceId, appointmentDate, models) {
    try {
      // Validate appointmentDate before processing
      const date = new Date(appointmentDate);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid appointment date: ${appointmentDate}`);
      }
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      const cacheKey = `${practiceId}-${dateStr}`;

      // Check if we have a counter for this day
      if (!this.appointmentCounters.has(cacheKey)) {
        // If models provided, check existing appointments for the day
        let maxNumber = 0;

        if (models && models.Appointment) {
          try {
            // Get start and end of the day in local time
            const startOfDay = new Date(appointmentDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(appointmentDate);
            endOfDay.setHours(23, 59, 59, 999);

            // Find appointments for this day
            const existingAppointments = await models.Appointment.find({
              date: {
                $gte: startOfDay,
                $lte: endOfDay
              }
            }).select('appointmentNumber').lean();

            // Parse existing appointment numbers to find the max
            for (const apt of existingAppointments) {
              if (apt.appointmentNumber) {
                const match = apt.appointmentNumber.match(/\d{8}-(\d{3})/);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxNumber) {
                    maxNumber = num;
                  }
                }
              }
            }
          } catch (error) {
            console.warn('Could not check existing appointments:', error.message);
          }
        }

        this.appointmentCounters.set(cacheKey, maxNumber);
      }

      // Increment counter and generate number
      const currentCount = this.appointmentCounters.get(cacheKey) + 1;
      this.appointmentCounters.set(cacheKey, currentCount);

      // Format with leading zeros
      const appointmentNumber = `${dateStr}-${String(currentCount).padStart(3, '0')}`;

      console.log(`📋 Generated appointment number: ${appointmentNumber}`);
      return appointmentNumber;

    } catch (error) {
      console.error('Error generating appointment number:', error);
      // Fallback to timestamp-based number
      const fallbackNumber = `APT-${Date.now()}`;
      console.log(`📋 Using fallback appointment number: ${fallbackNumber}`);
      return fallbackNumber;
    }
  }

  /**
   * Reset counters for a new day (optional cleanup)
   */
  resetDailyCounters() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // Remove old counters (keep only today's)
    for (const [key] of this.appointmentCounters) {
      if (!key.includes(today)) {
        this.appointmentCounters.delete(key);
      }
    }
  }
}

// Export singleton instance
module.exports = new QueueManagementService();