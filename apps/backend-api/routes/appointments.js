const SecureDataAccess = require('../services/secureDataAccess');
const express = require('express');
// const SecureDataAccess = require('../services/secureDataAccess'); // Duplicate removed
const router = express.Router();

// Initialize service authentication for appointments
const serviceAccountManager = require('../services/serviceAccountManager');
const roleModel = require('../config/roles');

// Store service authentication token
let serviceAuth = null;

// Auto-authenticate service on startup
(async () => {
  try {
    serviceAuth = await serviceAccountManager.authenticate('appointments-api');
    if (serviceAuth) {
      console.log('✅ Appointments API service authenticated');
    }
  } catch (error) {
    console.log('⚠️ Appointments service auth will be attempted on first request');
  }
})();

// Appointment model is accessed via req.models for multi-tenancy
// Models are accessed via req.models for multi-tenancy
// const Patient = require('../models/Patient'); // REMOVED - Use req.models.Patient
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../middleware/practiceContext');
// Basic validation helper
const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }
    next();
  };
};

// Apply middleware to all routes (correct order: context → models → auth)
// Routes are now ordered correctly: specific routes before parameterized routes
router.use(practiceContext);
router.use(practiceModels);
router.use(practiceAuth);

/**
 * @route   POST /appointments
 * @desc    Schedule a new appointment
 * @access  Private (Doctor, Nurse, Receptionist)
 * @param   {string} patientId - Patient ID
 * @param   {string} appointmentType - Type of appointment
 * @param   {string} appointmentReason - Reason for appointment
 * @param   {string} scheduledDate - Date of appointment (YYYY-MM-DD)
 * @param   {string} scheduledTime - Time of appointment (HH:MM)
 * @param   {string} providerName - Provider name
 * @param   {number} duration - Duration in minutes
 */
router.post('/', validateRequired(['patientId', 'appointmentType', 'appointmentReason', 'scheduledDate', 'scheduledTime', 'providerName']), async (req, res) => {
  try {
    const { 
      patientId, 
      appointmentType, 
      appointmentReason, 
      scheduledDate, 
      scheduledTime,
      providerName,
      providerId,
      duration,
      notes,
      priority,
      department,
      room
    } = req.body;

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    // Verify patient exists and belongs to practice
    const patientResults = await SecureDataAccess.query('patients', {
      _id: patientId,
      practiceId: req.practiceContext.practiceId
    }, { limit: 1 }, context);

    const patient = patientResults[0];
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found in this practice'
      });
    }

    // Generate appointment number
    const appointmentNumber = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Parse scheduled date with multiple format support
    let parsedDate;
    if (scheduledDate.includes('/')) {
      const parts = scheduledDate.split('/');
      if (parts.length === 3) {
        const country = req.practiceContext?.country || 'Israel';
        if (country === 'US') {
          // MM/DD/YYYY
          parsedDate = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        } else {
          // DD/MM/YYYY
          parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        }
      }
    } else if (scheduledDate.includes('-')) {
      const parts = scheduledDate.split('-');
      if (parts[0].length === 4) {
        parsedDate = new Date(scheduledDate); // YYYY-MM-DD
      } else {
        parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); // DD-MM-YYYY
      }
    } else if (scheduledDate.includes('.')) {
      const parts = scheduledDate.split('.');
      parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`); // DD.MM.YYYY
    } else {
      parsedDate = new Date(scheduledDate);
    }
    
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: req.practiceContext?.language === 'he' 
          ? 'תאריך לא תקין'
          : 'Invalid date format'
      });
    }

    // Create appointment object
    const appointment = {
      // Patient Information
      patientId: patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientPhone: patient.phone,
      patientEmail: patient.email,
      
      // Appointment Details
      appointmentNumber: appointmentNumber,
      appointmentType: appointmentType,
      appointmentReason: appointmentReason,
      notes: notes || '',
      
      // Scheduling
      scheduledDate: parsedDate,
      scheduledTime: scheduledTime,
      duration: duration || 30,
      
      // Provider Information
      providerId: providerId,
      providerName: providerName,
      department: department,
      room: room,
      
      // Status
      status: 'scheduled',
      priority: priority || 'routine',
      
      // Practice Information
      practiceId: req.practiceContext.practiceId,
      practiceName: req.practiceContext.practiceName,
      
      // Metadata
      createdAt: new Date(),
      createdBy: req.user.id,
      lastUpdated: new Date()
    };

    const savedAppointment = await SecureDataAccess.insert('appointments', appointment, context);
    
    // Log the appointment creation for audit
    await SecureDataAccess.insert('audit_logs', {
      action: 'CREATE_APPOINTMENT',
      patientId: patientId,
      appointmentId: savedAppointment.insertedId,
      userId: req.user.id,
      practiceId: req.practiceContext.practiceId,
      details: { appointmentNumber, appointmentType, scheduledDate, scheduledTime },
      timestamp: new Date()
    }, context);

    // Log the appointment creation
    console.log(`Appointment scheduled: ${appointmentNumber} for patient ${patient.firstName} ${patient.lastName} on ${scheduledDate} at ${scheduledTime}`);

    res.status(201).json({
      success: true,
      data: savedAppointment.insertedId ? { ...appointment, _id: savedAppointment.insertedId } : appointment,
      message: 'Appointment scheduled successfully'
    });

  } catch (error) {
    console.error('Error scheduling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule appointment',
      details: error.message
    });
  }
});

/**
 * @route   GET /appointments/patient/:patientId
 * @desc    Get all appointments for a patient
 * @access  Private
 * @param   {string} status - Filter by status
 * @param   {string} dateFrom - Filter from date
 * @param   {string} dateTo - Filter to date
 * @param   {number} limit - Limit results
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status, dateFrom, dateTo, limit = 50 } = req.query;

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    // Verify patient exists and belongs to practice
    const patientResults = await SecureDataAccess.query('patients', {
      _id: patientId,
      practiceId: req.practiceContext.practiceId
    }, { limit: 1 }, context);

    const patient = patientResults[0];
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found in this practice'
      });
    }

    // Get all appointments for this patient and practice
    const query = { 
      patientId: patientId, 
      practiceId: req.practiceContext.practiceId 
    };
    
    // Get appointments using SecureDataAccess
    const allAppointments = await SecureDataAccess.query('appointments', query, {}, context);

    // Apply filters in JavaScript (no MongoDB operators)
    let filteredAppointments = allAppointments;
    
    // Status filter
    if (status) {
      filteredAppointments = filteredAppointments.filter(apt => apt.status === status);
    }
    
    // Date range filter in JavaScript
    if (dateFrom || dateTo) {
      filteredAppointments = filteredAppointments.filter(apt => {
        const aptDate = new Date(apt.scheduledDate);
        let matches = true;
        
        if (dateFrom) {
          matches = matches && aptDate >= new Date(dateFrom);
        }
        if (dateTo) {
          matches = matches && aptDate <= new Date(dateTo);
        }
        
        return matches;
      });
    }
    
    // Sort by scheduled date (newest first)
    filteredAppointments.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
    
    // Apply limit
    const appointments = filteredAppointments.slice(0, parseInt(limit));

    // Enhance appointments with additional info
    const enhancedAppointments = appointments.map(appointment => {
      const enhanced = { ...appointment };
      
      // Calculate time until appointment
      const now = new Date();
      const appointmentDateTime = new Date(`${enhanced.scheduledDate.toISOString().split('T')[0]}T${enhanced.scheduledTime}:00`);
      enhanced.timeUntilAppointment = Math.floor((appointmentDateTime - now) / (1000 * 60 * 60)); // hours
      
      // Status indicators
      enhanced.isToday = now.toDateString() === new Date(enhanced.scheduledDate).toDateString();
      enhanced.isOverdue = now > appointmentDateTime && enhanced.status === 'scheduled';
      enhanced.canCheckIn = enhanced.isToday && enhanced.status === 'scheduled';
      
      return enhanced;
    });

    res.json({
      success: true,
      data: enhancedAppointments,
      count: enhancedAppointments.length,
      message: `Found ${enhancedAppointments.length} appointments`
    });

  } catch (error) {
    console.error('Error getting patient appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve appointments',
      details: error.message
    });
  }
});

/**
 * @route   GET /appointments/today
 * @desc    Get today's appointments for practice
 * @access  Private
 */
router.get('/today', async (req, res) => {
  try {
    const { providerId, status, limit = 200 } = req.query;

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    // Get all appointments for this practice
    const allAppointments = await SecureDataAccess.query('appointments', {
      practiceId: req.practiceContext.practiceId
    }, {}, context);

    // Filter for today's appointments in JavaScript
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    let todaysAppointments = allAppointments.filter(apt => {
      const aptDate = new Date(apt.scheduledDate);
      return aptDate >= startOfDay && aptDate <= endOfDay;
    });

    // Apply filters
    if (providerId) {
      todaysAppointments = todaysAppointments.filter(apt => apt.providerId === providerId);
    }
    if (status) {
      todaysAppointments = todaysAppointments.filter(apt => apt.status === status);
    }

    // Apply limit
    const appointments = todaysAppointments.slice(0, parseInt(limit));

    // PERFORMANCE OPTIMIZATION: Return only essential fields for list operations
    // This reduces token count significantly for Claude AI
    const minimalAppointments = appointments.map(apt => ({
      _id: apt._id,
      patientName: apt.patientName || 'Unknown',
      patientId: apt.patientId,
      scheduledTime: apt.scheduledTime,
      appointmentType: apt.appointmentType,
      status: apt.status,
      providerName: apt.providerName,
      duration: apt.duration || 30
    }));

    // Group by time slots for easier scheduling view
    const timeSlots = {};
    minimalAppointments.forEach(appointment => {
      const timeKey = appointment.scheduledTime;
      if (!timeSlots[timeKey]) {
        timeSlots[timeKey] = [];
      }
      timeSlots[timeKey].push(appointment);
    });

    res.json({
      success: true,
      data: minimalAppointments,
      timeSlots: timeSlots,
      count: minimalAppointments.length,
      message: `Found ${minimalAppointments.length} appointments for today`
    });

  } catch (error) {
    console.error('Error getting today\'s appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve today\'s appointments',
      details: error.message
    });
  }
});

/**
 * @route   GET /appointments/:appointmentId
 * @desc    Get specific appointment details
 * @access  Private
 */
router.get('/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    const appointmentResults = await SecureDataAccess.query('appointments', {
      _id: appointmentId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const appointment = appointmentResults[0];

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      data: appointment,
      message: 'Appointment retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve appointment',
      details: error.message
    });
  }
});

/**
 * @route   PUT /appointments/:appointmentId/status
 * @desc    Update appointment status
 * @access  Private
 */
router.put('/:appointmentId/status', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, reason, notes } = req.body;

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    const validStatuses = [
      'scheduled', 'confirmed', 'checked-in', 'in-progress', 
      'completed', 'cancelled', 'no-show', 'rescheduled'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Valid options: ${validStatuses.join(', ')}`
      });
    }

    const appointmentResults = await SecureDataAccess.query('appointments', {
      _id: appointmentId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const appointment = appointmentResults[0];

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Update appointment status and notes
    const updateData = {
      $set: {
        status: status,
        lastUpdated: new Date(),
        lastUpdatedBy: req.user.id
      }
    };
    
    if (reason) {
      updateData.$set.statusReason = reason;
    }
    
    if (notes) {
      updateData.$set.notes = appointment.notes ? `${appointment.notes}\n${notes}` : notes;
    }

    await SecureDataAccess.update('appointments', { _id: appointment._id }, updateData, context);
    
    // Log the status update for audit
    await SecureDataAccess.insert('audit_logs', {
      action: 'UPDATE_APPOINTMENT_STATUS',
      appointmentId: appointment._id,
      userId: req.user.id,
      practiceId: req.practiceContext.practiceId,
      details: { 
        oldStatus: appointment.status, 
        newStatus: status, 
        reason: reason,
        notes: notes 
      },
      timestamp: new Date()
    }, context);
    
    // Update local object for response
    appointment.status = status;
    appointment.lastUpdated = new Date();
    appointment.lastUpdatedBy = req.user.id;
    if (reason) appointment.statusReason = reason;
    if (notes) appointment.notes = updateData.$set.notes;

    res.json({
      success: true,
      data: appointment,
      message: 'Appointment status updated successfully'
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment status',
      details: error.message
    });
  }
});

/**
 * @route   GET /appointments/available
 * @desc    Get available appointment slots for a provider
 * @access  Private
 */
router.get('/available', async (req, res) => {
  try {
    const { providerId, date, duration = 30, preferredTime } = req.query;
    
    // Check if practice context is available
    if (!req.practiceContext || !req.practiceContext.practiceId) {
      return res.status(500).json({
        success: false,
        message: {
          en: 'Practice context not available.',
          he: 'הקשר מרפאה אינו זמין.'
        }
      });
    }

    // Validate required parameters
    if (!providerId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: providerId and date'
      });
    }

    // Parse date - handle multiple formats
    let appointmentDate;
    
    // Try different date formats
    if (date.includes('/')) {
      // Check if DD/MM/YYYY (Israeli/European) or MM/DD/YYYY (US)
      const parts = date.split('/');
      if (parts.length === 3) {
        const [part1, part2, part3] = parts;
        
        // Determine format based on practice country
        const country = req.practiceContext?.country || 'Israel';
        
        if (country === 'US') {
          // US format: MM/DD/YYYY
          appointmentDate = new Date(`${part3}-${part1.padStart(2, '0')}-${part2.padStart(2, '0')}`);
        } else {
          // Israeli/European format: DD/MM/YYYY
          appointmentDate = new Date(`${part3}-${part2.padStart(2, '0')}-${part1.padStart(2, '0')}`);
        }
      }
    } else if (date.includes('-')) {
      // ISO format: YYYY-MM-DD or DD-MM-YYYY
      const parts = date.split('-');
      if (parts[0].length === 4) {
        // YYYY-MM-DD format
        appointmentDate = new Date(date);
      } else {
        // DD-MM-YYYY format
        appointmentDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    } else if (date.includes('.')) {
      // European format: DD.MM.YYYY
      const parts = date.split('.');
      appointmentDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
    } else {
      // Try to parse as is
      appointmentDate = new Date(date);
    }
    
    // Validate the date
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: req.practiceContext?.language === 'he' 
          ? 'תאריך לא תקין. פורמטים נתמכים: DD/MM/YYYY, YYYY-MM-DD'
          : 'Invalid date format. Supported formats: MM/DD/YYYY, YYYY-MM-DD'
      });
    }

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };
    
    // Get existing appointments for this provider and practice
    const allAppointments = await SecureDataAccess.query('appointments', {
      providerId: providerId,
      practiceId: req.practiceContext.practiceId
    }, {}, context);
    
    // Filter appointments by date and status in JavaScript
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingAppointments = allAppointments.filter(apt => {
      const aptDate = new Date(apt.scheduledDate);
      const validStatuses = ['scheduled', 'confirmed'];
      return aptDate >= startOfDay && 
             aptDate < endOfDay && 
             validStatuses.includes(apt.status);
    });

    // Generate available time slots (assuming 9:00 AM to 5:00 PM)
    const slots = [];
    const startHour = 9;
    const endHour = 17;
    const slotDuration = parseInt(duration);
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Check if this slot is already taken
        const isOccupied = existingAppointments.some(apt => apt.scheduledTime === timeSlot);
        
        if (!isOccupied) {
          slots.push({
            time: timeSlot,
            available: true,
            duration: slotDuration
          });
        }
      }
    }

    // If preferredTime is specified, check if it's available
    if (preferredTime) {
      const isPreferredAvailable = slots.some(slot => slot.time === preferredTime);
      
      if (!isPreferredAvailable) {
        // Check if time is occupied
        const conflictingAppointment = existingAppointments.find(apt => apt.scheduledTime === preferredTime);
        
        if (conflictingAppointment) {
          return res.status(409).json({
            success: false,
            error: 'conflict',
            message: req.practiceContext.language === 'he' 
              ? 'לרופא יש כבר פגישה בשעה זו' 
              : 'Doctor already has an appointment at this time',
            data: slots // Still return available slots
          });
        }
      }
    }

    res.json({
      success: true,
      data: slots,
      message: `Found ${slots.length} available slots`
    });

  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get available slots',
      details: error.message
    });
  }
});

/**
 * @route   PUT /appointments/:appointmentId/reschedule
 * @desc    Reschedule an appointment
 * @access  Private
 */
router.put('/:appointmentId/reschedule', validateRequired(['newDate', 'newTime']), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTime, reason } = req.body;

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    const appointmentResults = await SecureDataAccess.query('appointments', {
      _id: appointmentId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const appointment = appointmentResults[0];

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Reschedule appointment using SecureDataAccess
    const updateData = {
      $set: {
        scheduledDate: new Date(newDate),
        scheduledTime: newTime,
        status: 'rescheduled',
        lastUpdated: new Date(),
        lastUpdatedBy: req.user.id,
        rescheduleReason: reason || 'Rescheduled by staff'
      }
    };

    await SecureDataAccess.update('appointments', { _id: appointment._id }, updateData, context);
    
    // Update local object for response
    appointment.scheduledDate = new Date(newDate);
    appointment.scheduledTime = newTime;
    appointment.status = 'rescheduled';
    appointment.lastUpdated = new Date();
    appointment.lastUpdatedBy = req.user.id;
    appointment.rescheduleReason = reason || 'Rescheduled by staff';

    res.json({
      success: true,
      data: appointment,
      message: 'Appointment rescheduled successfully'
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule appointment',
      details: error.message
    });
  }
});

/**
 * @route   PUT /appointments/:appointmentId/vitals
 * @desc    Record patient vitals for appointment
 * @access  Private (Nurse, Doctor)
 */
router.put('/:appointmentId/vitals', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const vitalsData = req.body;

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    const appointmentResults = await SecureDataAccess.query('appointments', {
      _id: appointmentId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const appointment = appointmentResults[0];

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Record vitals using SecureDataAccess
    const updateData = {
      $set: {
        vitals: vitalsData,
        vitalsRecordedAt: new Date(),
        vitalsRecordedBy: req.user.id,
        lastUpdated: new Date(),
        lastUpdatedBy: req.user.id
      }
    };

    await SecureDataAccess.update('appointments', { _id: appointment._id }, updateData, context);
    
    // Update local object for response
    appointment.vitals = vitalsData;
    appointment.vitalsRecordedAt = new Date();
    appointment.vitalsRecordedBy = req.user.id;
    appointment.lastUpdated = new Date();
    appointment.lastUpdatedBy = req.user.id;

    res.json({
      success: true,
      data: appointment,
      message: 'Vitals recorded successfully'
    });

  } catch (error) {
    console.error('Error recording vitals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record vitals',
      details: error.message
    });
  }
});


/**
 * @route   GET /appointments/provider/:providerId
 * @desc    Get appointments for a specific provider
 * @access  Private
 */
router.get('/provider/:providerId', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { date, limit = 100 } = req.query;

    // Get practice ID from various sources with proper fallbacks
    const practiceId = req.practiceContext?.practiceId ||
                      req.practice?.subdomain ||
                      req.practiceSubdomain ||
                      req.practice?.id;

    console.log(`🏥 Practice context:`, {
      practiceId: practiceId,
      practiceContext: req.practiceContext,
      practice: req.practice,
      providerId: providerId
    });

    // Ensure we have service auth
    if (!serviceAuth) {
      try {
        serviceAuth = await serviceAccountManager.authenticate('appointments-api');
      } catch (error) {
        console.error('Failed to authenticate appointments service:', error);
      }
    }

    // Define security context for SecureDataAccess
    const context = {
      serviceId: 'appointments-api',
      operation: 'getDoctorAppointments',
      practiceId: practiceId,
      userId: req.user?.id || req.user?._id || 'anonymous',
      apiKey: serviceAuth?.sessionToken || serviceAuth?.apiKey || serviceAuth?.token
    };

    // Get all appointments for this provider and practice
    // Try multiple fields to find appointments
    console.log(`🔍 Searching appointments for provider: ${providerId} in practice: ${practiceId}`);

    // Check if user has a providerInfo.providerId and use it first
    const actualProviderId = req.user?.providerInfo?.providerId || providerId;
    console.log(`🔍 Using provider ID: ${actualProviderId} (from ${req.user?.providerInfo?.providerId ? 'providerInfo' : 'parameter'})`);

    let allAppointments = [];

    try {
      allAppointments = await SecureDataAccess.query('appointments', {
        providerId: actualProviderId,
        practiceId: practiceId
      }, {}, context);
      console.log(`✅ Found ${allAppointments.length} appointments with providerId: ${actualProviderId}`);
    } catch (err) {
      console.log(`⚠️ Error querying by providerId: ${err.message}`);
      allAppointments = [];
    }

    // If no appointments found with providerId, try with providerEmail
    if (allAppointments.length === 0) {
      console.log(`📧 No appointments found with providerId, trying with providerEmail: ${providerId}`);
      try {
        allAppointments = await SecureDataAccess.query('appointments', {
          providerEmail: providerId,
          practiceId: practiceId
        }, {}, context);
      } catch (err) {
        console.log(`⚠️ Error querying by providerEmail: ${err.message}`);
        allAppointments = [];
      }
    }

    // If still no appointments, try with providerName
    if (allAppointments.length === 0) {
      console.log(`👤 No appointments found with providerEmail, trying with providerName: ${providerId}`);
      try {
        allAppointments = await SecureDataAccess.query('appointments', {
          providerName: providerId,
          practiceId: practiceId
        }, {}, context);
      } catch (err) {
        console.log(`⚠️ Error querying by providerName: ${err.message}`);
        allAppointments = [];
      }
    }

    // Try to find appointments by user's name (for custom provider IDs)
    if (allAppointments.length === 0 && req.user) {
      console.log(`🔍 Trying to find appointments by provider name from user profile`);

      // Get user's full name from session/auth
      const userName = req.user.fullName || req.user.name ||
                      `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

      if (userName) {
        console.log(`👤 Searching for appointments with providerName: ${userName}`);
        try {
          allAppointments = await SecureDataAccess.query('appointments', {
            providerName: userName,
            practiceId: practiceId
          }, {}, context);
          console.log(`✅ Found ${allAppointments.length} appointments for provider name: ${userName}`);
        } catch (err) {
          console.log(`⚠️ Error querying by user's provider name: ${err.message}`);
        }
      }
    }

    // As a last resort, if user is admin/doctor, show all practice appointments
    if (allAppointments.length === 0) {
      // Check if we have user context from session
      const userRoles = req.session?.user?.roles || req.user?.roles || [];

      if (userRoles.length > 0) {
        const isProvider = roleModel.rolesAreAdmin(userRoles) || roleModel.rolesAreClinical(userRoles);

        if (isProvider) {
          console.log(`🏥 User is provider, fetching all practice appointments`);
          allAppointments = await SecureDataAccess.query('appointments', {
            practiceId: practiceId
          }, {}, context);
        }
      } else {
        // If no user roles available, just try to get all appointments for now
        console.log(`⚠️ No user roles available, attempting to fetch all practice appointments`);
        try {
          allAppointments = await SecureDataAccess.query('appointments', {
            practiceId: practiceId
          }, {}, context);
        } catch (err) {
          console.log(`❌ Failed to fetch all appointments: ${err.message}`);
          allAppointments = [];
        }
      }
    }

    console.log(`✅ Found ${allAppointments.length} total appointments`);

    // Filter by date if provided
    let filteredAppointments = allAppointments;
    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      
      filteredAppointments = allAppointments.filter(apt => {
        const aptDate = new Date(apt.scheduledDate);
        return aptDate >= startOfDay && aptDate <= endOfDay;
      });
    }

    // Apply limit
    const appointments = filteredAppointments.slice(0, parseInt(limit));

    res.json({
      success: true,
      data: appointments,
      count: appointments.length,
      message: `Found ${appointments.length} appointments for provider`
    });

  } catch (error) {
    console.error('Error getting provider appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider appointments',
      details: error.message
    });
  }
});

/**
 * @route   GET /appointments/overdue
 * @desc    Get overdue appointments for practice
 * @access  Private
 */
router.get('/overdue', async (req, res) => {
  try {
    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    // Get all appointments for this practice
    const allAppointments = await SecureDataAccess.query('appointments', {
      practiceId: req.practiceContext.practiceId
    }, {}, context);

    // Find overdue appointments in JavaScript
    const now = new Date();
    const overdueAppointments = allAppointments.filter(apt => {
      if (apt.status !== 'scheduled') return false;
      
      const aptDateTime = new Date(`${apt.scheduledDate.toISOString().split('T')[0]}T${apt.scheduledTime}:00`);
      return now > aptDateTime;
    });

    res.json({
      success: true,
      data: overdueAppointments,
      count: overdueAppointments.length,
      message: `Found ${overdueAppointments.length} overdue appointments`
    });

  } catch (error) {
    console.error('Error getting overdue appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve overdue appointments',
      details: error.message
    });
  }
});

/**
 * @route   GET /appointments/slots
 * @desc    Find available appointment slots
 * @access  Private
 * @param   {string} date - Date to check (YYYY-MM-DD)
 * @param   {string} providerId - Provider ID (optional)
 * @param   {string} providerName - Provider name (optional)
 * @param   {number} duration - Appointment duration in minutes (default: 30)
 * @param   {string} startTime - Override start time (optional)
 * @param   {string} endTime - Override end time (optional)
 * @param   {string} appointmentType - Type of appointment (optional)
 */
router.get('/slots', async (req, res) => {
  try {
    const { 
      date, 
      providerId, 
      providerName,
      duration = 30,
      startTime,
      endTime,
      appointmentType
    } = req.query;

    // Validate date
    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required (format: YYYY-MM-DD)'
      });
    }

    // Parse the date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Please use YYYY-MM-DD'
      });
    }

    // Define security context for SecureDataAccess with fallbacks
    const practiceId = req.practiceContext?.practiceId || req.practice?.subdomain || req.practiceSubdomain;
    const context = {
      serviceId: 'appointments-api',
      userId: req.user?.id || 'anonymous',
      operation: 'appointment_operation',
      practiceId: practiceId
    };

    // Get all appointments for this practice
    const allAppointments = await SecureDataAccess.query('appointments', {
      practiceId: req.practiceContext.practiceId
    }, {}, context);

    // Filter appointments by date, status and provider in JavaScript
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    let existingAppointments = allAppointments.filter(apt => {
      const aptDate = new Date(apt.scheduledDate);
      const excludedStatuses = ['cancelled', 'no-show'];
      
      let matches = aptDate >= startOfDay && 
                   aptDate < endOfDay && 
                   !excludedStatuses.includes(apt.status);
      
      // Add provider filter if specified
      if (providerId) {
        matches = matches && apt.providerId === providerId;
      } else if (providerName) {
        matches = matches && apt.providerName === providerName;
      }
      
      return matches;
    });

    // Try to get provider availability if we have a provider
    let providerAvailability = null;
    let workingHours = { startTime: '08:00', endTime: '20:00' }; // Extended default hours
    
    if (providerId || providerName) {
      // Try to get provider availability
      try {
        // Get all provider availabilities for this practice
        const availabilities = await SecureDataAccess.query('provideravailabilitys', {
          practiceId: req.practiceContext.practiceId,
          isActive: true
        }, {}, context);
        
        // Find the provider availability by providerId or providerName in JavaScript
        providerAvailability = availabilities.find(avail => 
          (providerId && avail.providerId === providerId) || 
          (providerName && avail.providerName === providerName)
        );
        
        if (providerAvailability) {
          // Note: getAvailabilityForDate is a model method, using basic availability
          // In production, implement proper availability logic
          workingHours.startTime = '08:00';
          workingHours.endTime = '17:00';
        }
      } catch (error) {
        console.log('ProviderAvailability model not initialized yet, using defaults');
      }
    }
    
    // Use override times if provided, otherwise use provider hours or defaults
    const finalStartTime = startTime || workingHours.startTime;
    const finalEndTime = endTime || workingHours.endTime;

    // Generate time slots
    const slots = [];
    const slotDuration = parseInt(duration);
    
    // Parse start and end times
    const [startHour, startMinute] = finalStartTime.split(':').map(Number);
    const [endHour, endMinute] = finalEndTime.split(':').map(Number);
    
    // Create slots for the day
    const currentSlot = new Date(targetDate);
    currentSlot.setHours(startHour, startMinute, 0, 0);
    
    const endOfWorkDay = new Date(targetDate);
    endOfWorkDay.setHours(endHour, endMinute, 0, 0);
    
    while (currentSlot < endOfWorkDay) {
      const slotTime = `${String(currentSlot.getHours()).padStart(2, '0')}:${String(currentSlot.getMinutes()).padStart(2, '0')}`;
      
      // Check if this slot is already booked
      const isBooked = existingAppointments.some(apt => {
        const aptTime = apt.scheduledTime;
        const aptDuration = apt.duration || 30;
        
        // Parse appointment time
        const [aptHour, aptMinute] = aptTime.split(':').map(Number);
        const aptStart = new Date(targetDate);
        aptStart.setHours(aptHour, aptMinute, 0, 0);
        
        const aptEnd = new Date(aptStart);
        aptEnd.setMinutes(aptEnd.getMinutes() + aptDuration);
        
        const slotEnd = new Date(currentSlot);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);
        
        // Check for overlap
        return (currentSlot < aptEnd && slotEnd > aptStart);
      });
      
      // Add slot information
      slots.push({
        time: slotTime,
        available: !isBooked,
        date: date,
        duration: slotDuration,
        providerId: providerId || null,
        providerName: providerName || 'Any available provider'
      });
      
      // Move to next slot
      currentSlot.setMinutes(currentSlot.getMinutes() + slotDuration);
    }
    
    // Filter to show only available slots if requested
    const availableOnly = req.query.availableOnly === 'true';
    const resultSlots = availableOnly ? slots.filter(s => s.available) : slots;
    
    res.json({
      success: true,
      data: resultSlots,
      summary: {
        date: date,
        totalSlots: slots.length,
        availableSlots: slots.filter(s => s.available).length,
        bookedSlots: slots.filter(s => !s.available).length,
        providerId: providerId || 'any',
        providerName: providerName || 'Any available provider',
        workingHours: `${finalStartTime} - ${finalEndTime}`,
        slotDuration: `${slotDuration} minutes`,
        providerScheduleFound: providerAvailability ? true : false
      },
      message: `Found ${slots.filter(s => s.available).length} available slots out of ${slots.length} total slots`
    });

  } catch (error) {
    console.error('Error finding available slots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find available slots',
      details: error.message
    });
  }
});

module.exports = router;