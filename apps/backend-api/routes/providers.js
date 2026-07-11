const { ObjectId } = require('mongodb');
const express = require('express');
const SecureDataAccess = require('../services/secureDataAccess');
const router = express.Router();
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext, practiceModels } = require('../middleware/practiceContext');
const roleModel = require('../config/roles');

// Apply middleware to all routes
// practiceContext must come first to set up req.practiceDb
router.use(practiceContext);
router.use(practiceModels);  // Add practiceModels to set up req.models
router.use(practiceAuth);

/**
 * @route   GET /providers
 * @desc    Get all providers in the practice
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    // Check if models are available
    if (!req.models || !req.models.User) {
      console.error('Models not available in providers route');
      return res.status(500).json({
        success: false,
        error: 'Database models not initialized',
        details: 'Practice context not properly set up'
      });
    }
    
    const { includeInactive = false, department, specialty, name } = req.query;
    
    // Build query
    const query = {};
    const andConditions = [];
    
    // Always require provider info
    andConditions.push({ 'providerInfo.providerId': { $exists: true } });
    
    if (!includeInactive) {
      andConditions.push({ status: 'active' });
    }
    
    if (department) {
      andConditions.push({ 'providerInfo.departments': department });
    }
    
    if (specialty) {
      andConditions.push({ 'providerInfo.specialties': specialty });
    }
    
    if (name) {
      // Search by name (case-insensitive, partial match)
      andConditions.push({
        $or: [
          { 'profile.firstName': { $regex: name, $options: 'i' } },
          { 'profile.lastName': { $regex: name, $options: 'i' } }
        ]
      });
    }
    
    // Combine all conditions with $and
    if (andConditions.length > 0) {
      query.$and = andConditions;
    }
    
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'get-all-providers',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Get users who are providers
    const providers = await SecureDataAccess.query('users', query, {
      fields: ['email', 'profile', 'providerInfo', 'appointments.stats', 'roles', 'status'],
      sort: { 'profile.lastName': 1, 'profile.firstName': 1 }
    }, context);
    
    // Transform data for response
    const providerList = providers.map(user => {
      try {
        // Build the provider name manually to avoid virtual property issues
        let providerName = '';
        if (user.profile) {
          const firstName = user.profile.firstName || '';
          const lastName = user.profile.lastName || '';
          const title = user.profile.title || '';
          if (title) {
            providerName = `${title} ${firstName} ${lastName}`.trim();
          } else {
            providerName = `${firstName} ${lastName}`.trim();
          }
        }
        if (!providerName) {
          providerName = user.email || 'Unknown Provider';
        }
        
        return {
          userId: user._id,
          providerId: user.providerInfo?.providerId || user._id.toString(),
          name: providerName,
          email: user.email,
          roles: user.roles,
          status: user.status,
          specialties: user.providerInfo?.specialties || [],
          departments: user.providerInfo?.departments || [],
          appointmentSettings: user.providerInfo?.appointmentSettings,
          stats: user.providerInfo?.stats,
          canTakeAppointments: !!(user.status === 'active' && user.providerInfo?.providerId)
        };
      } catch (err) {
        console.error('Error transforming provider:', err.message, 'for user:', user._id);
        // Return a minimal provider object on error
        return {
          userId: user._id,
          providerId: user._id.toString(),
          name: user.email || 'Unknown',
          email: user.email,
          roles: user.roles || [],
          status: user.status || 'unknown',
          specialties: [],
          departments: [],
          canTakeAppointments: false
        };
      }
    });
    
    res.json({
      success: true,
      data: providerList,
      count: providerList.length
    });
    
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch providers',
      details: error.message
    });
  }
});

/**
 * @route   GET /providers/:providerId/availability
 * @desc    Get provider's availability schedule
 * @access  Private - Own schedule or Admin/Secretary roles only
 */
router.get('/:providerId/availability', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { date } = req.query;
    
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'get-provider-availability',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Get the user first
    const users = await SecureDataAccess.query('users', {
      $or: [
        { 'providerInfo.providerId': providerId },
        { _id: providerObjectId }
      ]
    }, {limit: 1}, context);
    
    const user = users[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }
    
    // Check authorization - users can see their own availability OR admins/secretaries can see all
    const requestingUsers = await SecureDataAccess.query('users', { _id: req.user.id }, {limit: 1}, context);
    const requestingUser = requestingUsers[0];
    const canViewSchedule = 
      // User viewing their own schedule
      req.user.id === user._id.toString() ||
      // Admin can view all schedules
      roleModel.rolesAreAdmin(requestingUser.roles) ||
      // User has explicit permission to manage users
      requestingUser.permissions.includes('manage_users');
    
    if (!canViewSchedule) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this provider\'s schedule'
      });
    }
    
    // Get provider availability
    const availabilities = await SecureDataAccess.query('provideravailabilitys', {
      userId: user._id,
      practiceId: req.practiceContext.practiceId,
      isActive: true
    }, {limit: 1}, context);
    
    const availability = availabilities[0];
    
    if (!availability) {
      return res.json({
        success: true,
        data: {
          providerId: user.getProviderId(),
          providerName: user.getProviderName(),
          hasSchedule: false,
          message: 'No availability schedule configured for this provider'
        }
      });
    }
    
    // If date specified, get availability for that date
    if (date) {
      const dayAvailability = availability.getAvailabilityForDate(date);
      return res.json({
        success: true,
        data: {
          providerId: user.getProviderId(),
          providerName: user.getProviderName(),
          date: date,
          ...dayAvailability
        }
      });
    }
    
    // Return full schedule
    res.json({
      success: true,
      data: {
        providerId: user.getProviderId(),
        providerName: user.getProviderName(),
        regularSchedule: availability.regularSchedule,
        specialAvailability: availability.specialAvailability,
        blockedTimes: availability.blockedTimes,
        breakTimes: availability.breakTimes,
        settings: availability.settings
      }
    });
    
  } catch (error) {
    console.error('Error fetching provider availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider availability',
      details: error.message
    });
  }
});

/**
 * @route   POST /providers/:providerId/availability
 * @desc    Set or update provider's availability schedule
 * @access  Private (Provider or Admin)
 */
router.post('/:providerId/availability', async (req, res) => {
  try {
    const { providerId } = req.params;
    const scheduleData = req.body;
    
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'set-provider-availability',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Get the user
    const users = await SecureDataAccess.query('users', {
      $or: [
        { 'providerInfo.providerId': providerId },
        { _id: providerObjectId }
      ]
    }, {limit: 1}, context);
    
    const user = users[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }
    
    // Check permissions (provider can update own schedule, admin can update any)
    const isOwnSchedule = user._id.toString() === req.user.id;
    const isAdmin = roleModel.rolesAreAdmin(req.user.roles);
    
    if (!isOwnSchedule && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this provider\'s schedule'
      });
    }
    
    // Get or create availability record
    const availabilities = await SecureDataAccess.query('provideravailabilitys', {
      userId: user._id,
      practiceId: req.practiceContext.practiceId
    }, {limit: 1}, context);
    
    let availability = availabilities[0];
    
    if (!availability) {
      // Create new availability
      const availabilityData = {
        userId: user._id,
        providerId: user.providerInfo?.providerId || user._id.toString(),
        providerName: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || user.email,
        providerType: user.roles.includes('doctor') ? 'doctor' : 
                     user.roles.includes('nurse') ? 'nurse' : 'other',
        practiceId: req.practiceContext.practiceId,
        createdBy: req.user.id,
        ...scheduleData
      };
      
      availability = await SecureDataAccess.insert('provideravailabilitys', availabilityData, context);
    } else {
      // Update existing
      await SecureDataAccess.update('provideravailabilitys', 
        { _id: availability._id },
        {
          ...scheduleData,
          updatedBy: req.user.id,
          lastUpdated: new Date()
        }, 
        context
      );
    }
    
    // Update user's availabilityId reference
    await SecureDataAccess.update('users', 
      { _id: user._id },
      {
        'providerInfo.availabilityId': availability._id
      },
      context
    );
    
    res.json({
      success: true,
      data: availability,
      message: 'Provider availability updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating provider availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update provider availability',
      details: error.message
    });
  }
});

/**
 * @route   POST /providers/:providerId/block-time
 * @desc    Block time for vacation, conference, etc.
 * @access  Private (Provider or Admin)
 */
router.post('/:providerId/block-time', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { startDate, endDate, reason, description } = req.body;
    
    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }
    
    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'block-provider-time',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Get the user
    const users = await SecureDataAccess.query('users', {
      $or: [
        { 'providerInfo.providerId': providerId },
        { _id: providerObjectId }
      ]
    }, {limit: 1}, context);
    
    const user = users[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found'
      });
    }
    
    // Check permissions
    const isOwnSchedule = user._id.toString() === req.user.id;
    const isAdmin = roleModel.rolesAreAdmin(req.user.roles);
    
    if (!isOwnSchedule && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to block time for this provider'
      });
    }
    
    // Get availability record
    const ProviderAvailability = req.models.ProviderAvailability;
    const availabilityResults = await SecureDataAccess.query('provideravailabilitys', {
      userId: user._id, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);

    const availability = availabilityResults[0];
    
    if (!availability) {
      return res.status(404).json({
        success: false,
        error: 'No availability schedule found for this provider'
      });
    }
    
    // Add blocked time
    availability.blockedTimes.push({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason: reason || 'other',
      description: description,
      createdBy: req.user.id,
      createdAt: new Date()
    });
    
    await SecureDataAccess.update('collection', { _id: availability._id }, availability, context);
    
    res.json({
      success: true,
      data: availability.blockedTimes[availability.blockedTimes.length - 1],
      message: 'Time blocked successfully'
    });
    
  } catch (error) {
    console.error('Error blocking time:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to block time',
      details: error.message
    });
  }
});

/**
 * @route   GET /providers/:providerId/appointments
 * @desc    Get provider's appointments
 * @access  Private
 */
router.get('/:providerId/appointments', async (req, res) => {
  try {
    const { providerId } = req.params;
    const { date, startDate, endDate, status, limit = 100 } = req.query;
    
    // Build query
    const query = {
      providerId: providerId,
      practiceId: req.practiceContext.practiceId
    };
    
    // Date filters
    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.scheduledDate = { $gte: targetDate, $lt: nextDay };
    } else if (startDate || endDate) {
      query.scheduledDate = {};
      if (startDate) query.scheduledDate.$gte = new Date(startDate);
      if (endDate) query.scheduledDate.$lte = new Date(endDate);
    }
    
    if (status) {
      query.status = status;
    }
    
    // Get appointments
    const Appointment = req.models.Appointment;
    const appointments = await SecureDataAccess.query('appointments', query, {}, context)
      .populate('patientId', 'firstName lastName phone email')
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data: appointments,
      count: appointments.length
    });
    
  } catch (error) {
    console.error('Error fetching provider appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider appointments',
      details: error.message
    });
  }
});

/**
 * @route   PUT /providers/:userId/settings
 * @desc    Update provider settings
 * @access  Private (Provider or Admin)
 */
router.put('/:userId/settings', async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = req.body;
    
    // Get the user
    const userResults = await req.models.SecureDataAccess.query('users', { _id: userObjectId }, { limit: 1 }, context);

    const user = userResults[0];
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Check permissions
    const isOwnProfile = user._id.toString() === req.user.id;
    const isAdmin = req.user.roles.includes('admin');
    
    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this provider\'s settings'
      });
    }
    
    // Initialize providerInfo if it doesn't exist
    if (!user.providerInfo) {
      user.providerInfo = {};
    }
    
    // Update provider settings
    if (settings.providerId) {
      user.providerInfo.providerId = settings.providerId;
    }
    
    if (settings.licenseNumber) {
      user.providerInfo.licenseNumber = settings.licenseNumber;
      user.providerInfo.licenseState = settings.licenseState;
      user.providerInfo.licenseExpiry = settings.licenseExpiry;
    }
    
    if (settings.specialties) {
      user.providerInfo.specialties = settings.specialties;
    }
    
    if (settings.departments) {
      user.providerInfo.departments = settings.departments;
    }
    
    if (settings.appointmentSettings) {
      user.providerInfo.appointmentSettings = {
        ...user.providerInfo.appointmentSettings,
        ...settings.appointmentSettings
      };
    }
    
    if (settings.billing) {
      user.providerInfo.billing = {
        ...user.providerInfo.billing,
        ...settings.billing
      };
    }
    
    await SecureDataAccess.update('collection', { _id: user._id }, user, context);
    
    res.json({
      success: true,
      data: user.providerInfo,
      message: 'Provider settings updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating provider settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update provider settings',
      details: error.message
    });
  }
});

module.exports = router;