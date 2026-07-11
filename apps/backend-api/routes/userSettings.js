const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { fullClinicAuth } = require('../middleware/practiceAuth');
const roleModel = require('../config/roles');

// Get user settings
router.get('/settings', fullClinicAuth, async (req, res) => {
  try {
    const user = await req.models.User.findById(req.user.id)
      .select('-password -tempMfaSecret -tempBackupCodes');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });
  } catch (error) {
    console.error('Get user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting user settings'
    });
  }
});

// Update user settings
router.put('/settings', fullClinicAuth, async (req, res) => {
  try {
    const allowedFields = [
      'firstName', 'lastName', 'title', 'phone', 'preferredLanguage',
      'licenseNumber', 'licenseState', 'licenseExpiry', 'specialties', 'departments',
      'defaultDuration', 'bufferTime', 'maxDailyAppointments', 
      'allowDoubleBooking', 'allowVideoConsults', 'consultationTypes'
    ];

    const updates = {};
    
    // Profile fields
    if (req.body.firstName !== undefined) updates['profile.firstName'] = req.body.firstName;
    if (req.body.lastName !== undefined) updates['profile.lastName'] = req.body.lastName;
    if (req.body.title !== undefined) updates['profile.title'] = req.body.title;
    if (req.body.phone !== undefined) updates['profile.phone'] = req.body.phone;
    
    // Language preference
    if (req.body.preferredLanguage !== undefined) {
      updates.preferredLanguage = req.body.preferredLanguage;
    }

    // Timezone
    if (req.body.timezone !== undefined) {
      updates.timezone = req.body.timezone;
    }

    // Emergency contact
    if (req.body.emergencyName !== undefined || req.body.emergencyRelation !== undefined || req.body.emergencyPhone !== undefined) {
      if (req.body.emergencyName !== undefined) updates['profile.emergencyContact.name'] = req.body.emergencyName;
      if (req.body.emergencyRelation !== undefined) updates['profile.emergencyContact.relationship'] = req.body.emergencyRelation;
      if (req.body.emergencyPhone !== undefined) updates['profile.emergencyContact.phone'] = req.body.emergencyPhone;
    }

    // TTS voice preferences
    if (req.body.ttsPreferences) {
      const tts = req.body.ttsPreferences;
      if (tts.enabled !== undefined) updates['ttsPreferences.enabled'] = tts.enabled;
      if (tts.voiceId !== undefined) updates['ttsPreferences.voiceId'] = tts.voiceId;
      if (tts.modelId !== undefined) updates['ttsPreferences.modelId'] = tts.modelId;
    }

    // Notification preferences
    if (req.body.notificationPreferences) {
      const np = req.body.notificationPreferences;
      if (np.email !== undefined) updates['notificationPreferences.email'] = np.email;
      if (np.sms !== undefined) updates['notificationPreferences.sms'] = np.sms;
      if (np.push !== undefined) updates['notificationPreferences.push'] = np.push;
      if (np.appointmentReminders !== undefined) updates['notificationPreferences.appointmentReminders'] = np.appointmentReminders;
      if (np.systemAlerts !== undefined) updates['notificationPreferences.systemAlerts'] = np.systemAlerts;
      if (np.marketingMessages !== undefined) updates['notificationPreferences.marketingMessages'] = np.marketingMessages;
    }

    // Provider-specific fields (only for providers)
    const user = await req.models.User.findById(req.user.id);
    const isProvider = roleModel.rolesAreClinical(user && user.roles);

    if (isProvider) {
      // License info
      if (req.body.licenseNumber !== undefined) updates['providerInfo.licenseNumber'] = req.body.licenseNumber;
      if (req.body.licenseState !== undefined) updates['providerInfo.licenseState'] = req.body.licenseState;
      if (req.body.licenseExpiry !== undefined) updates['providerInfo.licenseExpiry'] = req.body.licenseExpiry;
      if (req.body.specialties !== undefined) updates['providerInfo.specialties'] = req.body.specialties;
      if (req.body.departments !== undefined) updates['providerInfo.departments'] = req.body.departments;
      
      // Appointment settings
      if (req.body.defaultDuration !== undefined) {
        updates['providerInfo.appointmentSettings.defaultDuration'] = req.body.defaultDuration;
      }
      if (req.body.bufferTime !== undefined) {
        updates['providerInfo.appointmentSettings.bufferTime'] = req.body.bufferTime;
      }
      if (req.body.maxDailyAppointments !== undefined) {
        updates['providerInfo.appointmentSettings.maxDailyAppointments'] = req.body.maxDailyAppointments;
      }
      if (req.body.allowDoubleBooking !== undefined) {
        updates['providerInfo.appointmentSettings.allowDoubleBooking'] = req.body.allowDoubleBooking;
      }
      if (req.body.allowVideoConsults !== undefined) {
        updates['providerInfo.appointmentSettings.allowVideoConsults'] = req.body.allowVideoConsults;
      }
      if (req.body.consultationTypes !== undefined) {
        updates['providerInfo.appointmentSettings.consultationTypes'] = req.body.consultationTypes;
      }
    }

    const updatedUser = await req.models.User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -tempMfaSecret -tempBackupCodes');

    res.json({
      success: true,
      message: 'Settings updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating settings'
    });
  }
});

// Change password
router.post('/change-password', fullClinicAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new passwords are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Get user with password field
    const user = await req.models.User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is passwordless
    if (user.isPasswordless) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change password for passwordless account'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
});

// Toggle passwordless authentication
router.post('/toggle-passwordless', fullClinicAuth, async (req, res) => {
  try {
    const { enable } = req.body;

    const user = await req.models.User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If enabling passwordless and user has no password, that's okay
    // If disabling passwordless, user must have a password
    if (!enable && !user.password) {
      return res.status(400).json({
        success: false,
        message: 'Please set a password before disabling passwordless authentication'
      });
    }

    user.isPasswordless = enable;
    await user.save();

    res.json({
      success: true,
      message: enable ? 'Passwordless authentication enabled' : 'Passwordless authentication disabled',
      isPasswordless: user.isPasswordless
    });
  } catch (error) {
    console.error('Toggle passwordless error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error toggling passwordless authentication'
    });
  }
});

// Get favorite providers
router.get('/favorite-providers', fullClinicAuth, async (req, res) => {
  try {
    const user = await req.models.User.findById(req.user.id);

    res.json({
      success: true,
      favoriteProviders: user?.appointments?.favoriteProviders || []
    });
  } catch (error) {
    console.error('Get favorite providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting favorite providers'
    });
  }
});

// Add/Remove favorite provider
router.post('/favorite-providers', fullClinicAuth, async (req, res) => {
  try {
    const { providerId, providerName, action } = req.body;

    if (!providerId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Provider ID and action are required'
      });
    }

    const user = await req.models.User.findById(req.user.id);

    if (!user.appointments) {
      user.appointments = { favoriteProviders: [] };
    }

    if (!user.appointments.favoriteProviders) {
      user.appointments.favoriteProviders = [];
    }

    if (action === 'add') {
      // Check if already exists
      const exists = user.appointments.favoriteProviders.some(
        fav => fav.providerId === providerId
      );

      if (!exists) {
        user.appointments.favoriteProviders.push({
          providerId,
          providerName: providerName || 'Unknown Provider',
          addedAt: new Date()
        });
      }
    } else if (action === 'remove') {
      user.appointments.favoriteProviders = user.appointments.favoriteProviders.filter(
        fav => fav.providerId !== providerId
      );
    }

    await user.save();

    res.json({
      success: true,
      message: action === 'add' ? 'Provider added to favorites' : 'Provider removed from favorites',
      favoriteProviders: user.appointments.favoriteProviders
    });
  } catch (error) {
    console.error('Update favorite providers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating favorite providers'
    });
  }
});

module.exports = router;