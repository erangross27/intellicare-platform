const express = require('express');
const router = express.Router();
const SecureDataAccess = require('../services/secureDataAccess');
const SecureSessionManager = require('../services/secureSessionManager');

// Get notifications for current user's practice
router.get('/', async (req, res) => {
  try {
    console.log('📬 GET /api/notifications called');

    // Check authentication
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) {
      console.log('   No session token found');
      return res.status(401).json({
        success: false,
        message: {
          en: 'Authentication required.',
          he: 'נדרשת הזדהות.'
        }
      });
    }

    // Validate session
    const session = await SecureSessionManager.validateSession(sessionToken);
    if (!session) {
      console.log('   Invalid session');
      return res.status(401).json({
        success: false,
        message: {
          en: 'Session expired or invalid.',
          he: 'הפעלה פגה או לא תקינה.'
        }
      });
    }

    // Extract practice info from session (required for multi-tenant isolation)
    const practiceSubdomain = session.practiceSubdomain || session.metadata?.practiceSubdomain;
    if (!practiceSubdomain) {
      console.log('   No practice context in session');
      return res.status(400).json({
        success: false,
        message: {
          en: 'Practice context required.',
          he: 'נדרש הקשר מרפאה.'
        }
      });
    }

    const currentUserId = session.userId;
    console.log('   Session validated:', { userId: currentUserId, practice: practiceSubdomain });

    const { limit = 20, sort = '-createdAt', status } = req.query;
    const practiceId = session.practiceId || '68d149ae84e9fc3da9b129b8'; // ObjectId for practice
    const subdomain = practiceSubdomain; // Use the subdomain from session

    console.log(`   Using practiceId: ${practiceId}, subdomain: ${subdomain}`);
    console.log(`   Database: intellicare_practice_${subdomain}`);

    const sdaContext = {
      serviceId: 'notifications-api',
      operation: 'fetch-notifications',
      practiceId: subdomain
    };

    // Build filter — scope to current user only
    // Each notification has a targetUserIds array with the intended recipient(s)
    const userIdStr = String(currentUserId);
    const filter = {
      targetUserIds: userIdStr
    };
    if (status) {
      filter.status = status;
    }

    // Debug logging
    console.log('   Querying notifications for userId:', userIdStr);

    // Get notifications from practice database
    const notifications = await SecureDataAccess.query(
      'notifications',
      filter,
      {
        limit: parseInt(limit),
        sort: { createdAt: -1 }
      },
      sdaContext
    );

    console.log(`📬 Found ${notifications.length} notifications for practice ${subdomain}`);
    if (notifications.length > 0) {
      console.log('   First notification:', notifications[0]);
    }

    res.json({
      success: true,
      notifications: notifications,
      practiceId: practiceId,
      practiceSubdomain: subdomain
    });

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    // Get session and extract subdomain
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const session = await SecureSessionManager.validateSession(sessionToken);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const subdomain = session.practiceSubdomain || session.metadata?.practiceSubdomain;
    if (!subdomain) {
      return res.status(400).json({ success: false, error: 'Practice context required' });
    }

    console.log(`📬 Marking notification ${id} as read in practice ${subdomain}`);

    // Convert string ID to MongoDB ObjectId if needed
    const { ObjectId } = require('mongoose').Types;
    const notificationId = ObjectId.isValid(id) ? new ObjectId(id) : id;

    const result = await SecureDataAccess.update(
      'notifications',
      { _id: notificationId },
      { status: 'read', readAt: new Date() },
      {
        serviceId: 'notifications-api',
        operation: 'mark-as-read',
        practiceId: subdomain // Use subdomain as practiceId for SecureDataAccess
      }
    );

    console.log(`📬 Update result:`, result);

    res.json({
      success: true,
      message: 'Notification marked as read',
      updated: result.modifiedCount || result.nModified || 1
    });

  } catch (error) {
    console.error('❌ Error updating notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification'
    });
  }
});

// Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    // Get session and extract subdomain
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const session = await SecureSessionManager.validateSession(sessionToken);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const subdomain = session.practiceSubdomain || session.metadata?.practiceSubdomain;
    if (!subdomain) {
      return res.status(400).json({ success: false, error: 'Practice context required' });
    }

    const userIdForMarkAll = String(session.userId);
    console.log(`📬 Marking all notifications as read for user ${userIdForMarkAll} in practice ${subdomain}`);

    await SecureDataAccess.update(
      'notifications',
      {
        status: 'unread',
        targetUserIds: userIdForMarkAll
      },
      { status: 'read', readAt: new Date() },
      {
        serviceId: 'notifications-api',
        operation: 'mark-all-read',
        practiceId: subdomain
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('❌ Error updating notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notifications'
    });
  }
});

module.exports = router;