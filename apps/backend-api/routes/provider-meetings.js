const { ObjectId } = require('mongodb');
const express = require('express');
const SecureDataAccess = require('../services/secureDataAccess');
const router = express.Router();
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext } = require('../middleware/practiceContext');

// Apply middleware to all routes
router.use(practiceAuth);
router.use(practiceContext);

/**
 * @route   POST /provider-meetings
 * @desc    Schedule a meeting between two providers (doctor-to-doctor)
 * @access  Private (Provider only)
 */
router.post('/', async (req, res) => {
  try {
    const {
      requestingProviderId,  // The doctor requesting the meeting
      targetProviderId,      // The doctor they want to meet with
      subject,               // Meeting subject
      description,           // Meeting description
      date,                  // Meeting date
      time,                  // Meeting time
      duration,              // Duration in minutes
      type                   // 'consultation', 'case_review', 'general', etc.
    } = req.body;
    
    // Validate that the requesting user is a provider
    const requestingUserResults = await req.models.SecureDataAccess.query('users', {
      $or: [
        { 'providerInfo.providerId': requestingProviderId }, 
        { _id: new ObjectId(requestingProviderId) }
      ]
    , limit: 1 }, {}, context);

    const requestingUser = requestingUserResults[0];
    
    if (!requestingUser || !requestingUser.providerInfo?.providerId) {
      return res.status(403).json({
        success: false,
        error: 'Only providers can schedule provider meetings'
      });
    }
    
    // Find the target provider
    const targetUserResults = await req.models.SecureDataAccess.query('users', {
      $or: [
        { 'providerInfo.providerId': targetProviderId }, 
        { _id: new ObjectId(targetProviderId) , limit: 1 },
        { email: targetProviderId } // Allow search by email too
      ]
    }, {}, context);

    const targetUser = targetUserResults[0];
    
    if (!targetUser || !targetUser.providerInfo?.providerId) {
      return res.status(404).json({
        success: false,
        error: 'Target provider not found'
      });
    }
    
    // Create a provider meeting record
    const ProviderMeeting = req.models.ProviderMeeting || req.models.Appointment;
    
    const meeting = new ProviderMeeting({
      type: 'provider_meeting',
      requestingProvider: {
        id: requestingUser.providerInfo.providerId,
        name: `${requestingUser.profile?.firstName} ${requestingUser.profile?.lastName}`,
        email: requestingUser.email
      },
      targetProvider: {
        id: targetUser.providerInfo.providerId,
        name: `${targetUser.profile?.firstName} ${targetUser.profile?.lastName}`,
        email: targetUser.email
      },
      subject: subject || 'Professional Consultation',
      description: description,
      meetingType: type || 'consultation',
      scheduledDate: new Date(date),
      scheduledTime: time,
      duration: duration || 30,
      status: 'pending', // Needs confirmation from target provider
      practiceId: req.practice.subdomain,
      createdAt: new Date()
    });
    
    await SecureDataAccess.update('collection', { _id: meeting._id }, meeting, context);
    
    res.json({
      success: true,
      data: meeting,
      message: 'Provider meeting request created successfully'
    });
    
  } catch (error) {
    console.error('Error creating provider meeting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create provider meeting',
      details: error.message
    });
  }
});

/**
 * @route   GET /provider-meetings
 * @desc    Get provider meetings for a specific provider
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { providerId, status } = req.query;
    
    if (!providerId) {
      return res.status(400).json({
        success: false,
        error: 'Provider ID is required'
      });
    }
    
    const ProviderMeeting = req.models.ProviderMeeting || req.models.Appointment;
    
    const query = {
      type: 'provider_meeting',
      $or: [
        { 'requestingProvider.id': providerId },
        { 'targetProvider.id': providerId }
      ]
    };
    
    if (status) {
      query.status = status;
    }
    
    const meetings = await SecureDataAccess.query('providermeetings', query, {}, context)
      .sort({ scheduledDate: -1 });
    
    res.json({
      success: true,
      data: meetings,
      count: meetings.length
    });
    
  } catch (error) {
    console.error('Error fetching provider meetings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch provider meetings',
      details: error.message
    });
  }
});

/**
 * @route   PUT /provider-meetings/:meetingId/confirm
 * @desc    Confirm or reject a provider meeting request
 * @access  Private
 */
router.put('/:meetingId/confirm', async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { status, reason } = req.body; // status: 'confirmed' or 'rejected'
    
    const ProviderMeeting = req.models.ProviderMeeting || req.models.Appointment;
    
    const meetingResults = await SecureDataAccess.query('providermeetings', { _id: new ObjectId(meetingId) }, { limit: 1 }, context);

    
    const meeting = meetingResults[0];
    
    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: 'Meeting not found'
      });
    }
    
    meeting.status = status;
    if (reason) {
      meeting.statusReason = reason;
    }
    meeting.respondedAt = new Date();
    
    await SecureDataAccess.update('collection', { _id: meeting._id }, meeting, context);
    
    res.json({
      success: true,
      data: meeting,
      message: `Meeting ${status} successfully`
    });
    
  } catch (error) {
    console.error('Error updating provider meeting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update provider meeting',
      details: error.message
    });
  }
});

module.exports = router;