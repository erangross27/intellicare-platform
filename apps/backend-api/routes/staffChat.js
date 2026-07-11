const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const SecureSessionManager = require('../services/secureSessionManager');
const encryptionService = require('../services/encryptionService');
const databaseFactory = require('../utils/databaseFactory');
const roleModel = require('../config/roles');

// Profile image upload — memory storage, max 500KB, images only
const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// No service account needed — uses native DB with session-based auth

// ─── Auth middleware (same pattern as notifications.js) ───

async function authenticateRequest(req, res) {
  const sessionToken = req.cookies?.sessionToken;
  if (!sessionToken) {
    res.status(401).json({ success: false, message: { en: 'Authentication required.', he: 'נדרשת הזדהות.' } });
    return null;
  }

  const session = await SecureSessionManager.validateSession(sessionToken);
  if (!session) {
    res.status(401).json({ success: false, message: { en: 'Session expired or invalid.', he: 'הפעלה פגה או לא תקינה.' } });
    return null;
  }

  const practiceSubdomain = session.practiceSubdomain || session.metadata?.practiceSubdomain;
  if (!practiceSubdomain) {
    res.status(400).json({ success: false, message: { en: 'Practice context required.', he: 'נדרש הקשר מרפאה.' } });
    return null;
  }

  return {
    userId: String(session.userId),
    practiceSubdomain,
    practiceId: session.practiceId
  };
}

async function getPracticeDb(subdomain) {
  return databaseFactory.getPracticeDatabase(subdomain, true);
}

// Helper: find conversation by ID and validate participant (native DB)
async function findConversation(subdomain, convIdStr, userId) {
  const db = await getPracticeDb(subdomain);
  const nativeDb = db.db ? db.db : db;
  const oid = new ObjectId(convIdStr);
  return nativeDb.collection('staff_conversations').findOne({
    _id: oid,
    'participants.userId': userId,
    isActive: true
  });
}

// ─── GET /users — List active practice users ───

router.get('/users', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    const users = await nativeDb.collection('users').find(
      { status: 'active' },
      { projection: { password: 0, apiKey: 0, sessionTokens: 0 } }
    ).toArray();

    const practiceUsers = users.map(u => ({
      _id: String(u._id),
      displayName: u.profile
        ? `${u.profile.firstName || ''} ${u.profile.lastName || ''}`.trim()
        : u.email?.split('@')[0] || 'Unknown',
      email: u.email,
      role: roleModel.primaryRole(u.roles),
      roles: roleModel.normalizeRoles(u.roles)
    }));

    res.json({ success: true, users: practiceUsers });
  } catch (error) {
    console.error('❌ Staff chat /users error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// ─── GET /conversations — User's conversations ───

router.get('/conversations', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    const conversations = await nativeDb.collection('staff_conversations')
      .find({ 'participants.userId': auth.userId, isActive: true })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    // Decrypt last message previews
    const decrypted = await Promise.all(conversations.map(async (conv) => {
      const convObj = { ...conv };
      if (convObj.lastMessage?.content && typeof convObj.lastMessage.content === 'object' && convObj.lastMessage.content.encrypted) {
        try {
          convObj.lastMessage.content = await encryptionService.decrypt(convObj.lastMessage.content);
        } catch {
          convObj.lastMessage.content = '[Encrypted]';
        }
      }
      return convObj;
    }));

    res.json({ success: true, conversations: decrypted });
  } catch (error) {
    console.error('❌ Staff chat /conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

// ─── POST /conversations — Create direct or group conversation ───

router.post('/conversations', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const { type, participantIds, name } = req.body;

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ success: false, error: 'type and participantIds required' });
    }

    // Ensure current user is included
    const allIds = [...new Set([auth.userId, ...participantIds.map(String)])];


    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    // For direct chats, check existing conversation (native DB)
    if (type === 'direct') {
      if (allIds.length !== 2) {
        return res.status(400).json({ success: false, error: 'Direct chat requires exactly 2 participants' });
      }
      const sortedKey = allIds.sort().join('_');

      const existing = await nativeDb.collection('staff_conversations').findOne(
        { participantKey: sortedKey, isActive: true }
      );

      if (existing) {
        return res.json({ success: true, conversation: existing, existing: true });
      }
    }

    // Look up participant display names and roles
    const users = await nativeDb.collection('users').find(
      { _id: { $in: allIds.map(id => { try { return new ObjectId(id); } catch { return id; } }) } },
      { projection: { password: 0, apiKey: 0, sessionTokens: 0 } }
    ).toArray();

    const participants = allIds.map(id => {
      const user = users.find(u => String(u._id) === id);
      return {
        userId: id,
        displayName: user?.profile
          ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim()
          : user?.email?.split('@')[0] || 'Unknown',
        role: roleModel.primaryRole(user?.roles)
      };
    });

    const conversationData = {
      type,
      participants,
      isActive: true,
      unreadCounts: {},
      lastMessage: { content: null, senderId: null, senderName: null, createdAt: null },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (type === 'direct') {
      conversationData.participantKey = allIds.sort().join('_');
    } else {
      conversationData.name = name || 'New Group';
      conversationData.groupAdmin = auth.userId;
    }

    const result = await nativeDb.collection('staff_conversations').insertOne(conversationData);
    const conversationId = result.insertedId;

    // For groups, send a system message
    if (type === 'group') {
      const senderUser = participants.find(p => p.userId === auth.userId);
      const systemContent = await encryptionService.encrypt(
        `${senderUser?.displayName || 'Someone'} created group "${name || 'New Group'}"`,
        'phi'
      );

      await nativeDb.collection('staff_messages').insertOne({
        conversationId: new ObjectId(conversationId),
        senderId: 'system',
        senderName: 'System',
        content: systemContent,
        messageType: 'system',
        readBy: {},
        createdAt: new Date()
      });

      // Notify all participants via Socket.IO
      if (global.io) {
        participants.forEach(p => {
          global.io.to(`user_${p.userId}`).emit('staff_chat_new_conversation', {
            conversationId: String(conversationId),
            type,
            name: name || 'New Group',
            participants
          });
        });
      }
    }

    res.json({
      success: true,
      conversation: { _id: conversationId, ...conversationData },
      existing: false
    });
  } catch (error) {
    console.error('❌ Staff chat POST /conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

// ─── GET /conversations/:id — Get single conversation ───

router.get('/conversations/:id', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    res.json({ success: true, conversation: conv });
  } catch (error) {
    console.error('❌ Staff chat GET /conversations/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversation' });
  }
});

// ─── PUT /conversations/:id — Update group (name, participants) ───

router.put('/conversations/:id', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const { name, addParticipantIds, removeParticipantIds } = req.body;
    const convId = new ObjectId(req.params.id);

    // Verify user is participant and it's a group
    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv || conv.type !== 'group') {
      return res.status(404).json({ success: false, error: 'Group not found or not a group' });
    }
    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    const updateOps = { $set: { updatedAt: new Date() } };

    if (name) {
      updateOps.$set.name = name;
    }

    // Add participants
    if (addParticipantIds?.length) {
      const newUsers = await nativeDb.collection('users').find(
        { _id: { $in: addParticipantIds.map(id => { try { return new ObjectId(id); } catch { return id; } }) } },
        { projection: { password: 0, apiKey: 0 } }
      ).toArray();

      const newParticipants = addParticipantIds.map(id => {
        const user = newUsers.find(u => String(u._id) === id);
        return {
          userId: String(id),
          displayName: user?.profile
            ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim()
            : user?.email?.split('@')[0] || 'Unknown',
          role: roleModel.primaryRole(user?.roles)
        };
      });

      updateOps.$push = { participants: { $each: newParticipants } };
    }

    // Remove participants
    if (removeParticipantIds?.length) {
      updateOps.$pull = { participants: { userId: { $in: removeParticipantIds.map(String) } } };
    }

    await nativeDb.collection('staff_conversations').updateOne({ _id: convId }, updateOps);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Staff chat PUT /conversations/:id error:', error);
    res.status(500).json({ success: false, error: 'Failed to update conversation' });
  }
});

// ─── GET /conversations/:id/messages — Paginated messages (decrypted) ───

router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const convId = new ObjectId(req.params.id);
    // Verify user is participant (native DB)
    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const { limit = 50, before } = req.query;
    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    const msgFilter = {
      conversationId: convId,
      deletedFor: { $nin: [auth.userId] }
    };
    if (before) {
      msgFilter.createdAt = { $lt: new Date(before) };
    }

    const messages = await nativeDb.collection('staff_messages')
      .find(msgFilter)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 100))
      .toArray();

    // Decrypt messages
    const decrypted = await Promise.all(messages.map(async (msg) => {
      const msgObj = msg.toObject ? msg.toObject() : { ...msg };

      // Handle deleted for everyone
      if (msgObj.deletedForEveryone) {
        msgObj.content = null;
      } else if (msgObj.content && typeof msgObj.content === 'object' && msgObj.content.encrypted) {
        try {
          msgObj.content = await encryptionService.decrypt(msgObj.content);
        } catch {
          msgObj.content = '[Encrypted content]';
        }
      }

      // Decrypt replyTo content
      if (msgObj.replyTo?.content && typeof msgObj.replyTo.content === 'object' && msgObj.replyTo.content.encrypted) {
        try {
          msgObj.replyTo.content = await encryptionService.decrypt(msgObj.replyTo.content);
        } catch {
          msgObj.replyTo.content = '[Encrypted]';
        }
      }

      // Convert reactions Map to plain object
      if (msgObj.reactions instanceof Map) {
        msgObj.reactions = Object.fromEntries(msgObj.reactions);
      }
      if (!msgObj.reactions) msgObj.reactions = {};

      return msgObj;
    }));

    // Return in chronological order
    res.json({ success: true, messages: decrypted.reverse() });
  } catch (error) {
    console.error('❌ Staff chat GET /messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// ─── POST /conversations/:id/messages — Send message (encrypt + emit) ───

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const { content, messageType = 'text', replyToMessageId, forwardedFrom } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'Message content required' });
    }

    const convId = new ObjectId(req.params.id);

    // Verify sender is participant (native DB)
    const convObj = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!convObj) {
      return res.status(403).json({ success: false, error: 'Not a participant' });
    }

    // Get sender display name
    const senderParticipant = convObj.participants.find(p => p.userId === auth.userId);
    const senderName = senderParticipant?.displayName || 'Unknown';

    // Encrypt content
    const encryptedContent = await encryptionService.encrypt(content, 'phi');

    // Build reply-to snapshot if replying
    let replyTo = null;
    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    if (replyToMessageId) {
      try {
        const origMsg = await nativeDb.collection('staff_messages').findOne({
          _id: new ObjectId(replyToMessageId),
          conversationId: convId
        });
        if (origMsg) {
          let decryptedSnippet = '';
          if (origMsg.content && typeof origMsg.content === 'object' && origMsg.content.encrypted) {
            try {
              const full = await encryptionService.decrypt(origMsg.content);
              decryptedSnippet = typeof full === 'string' ? full.substring(0, 200) : '';
            } catch { decryptedSnippet = ''; }
          } else if (typeof origMsg.content === 'string') {
            decryptedSnippet = origMsg.content.substring(0, 200);
          }
          const encryptedSnippet = decryptedSnippet
            ? await encryptionService.encrypt(decryptedSnippet, 'phi')
            : null;
          replyTo = {
            messageId: origMsg._id,
            senderId: origMsg.senderId,
            senderName: origMsg.senderName,
            content: encryptedSnippet,
            messageType: origMsg.messageType || 'text'
          };
        }
      } catch (e) {
        console.error('Failed to build replyTo snapshot:', e);
      }
    }

    // Insert message (native DB)
    const messageData = {
      conversationId: convId,
      senderId: auth.userId,
      senderName,
      content: encryptedContent,
      messageType,
      readBy: { [auth.userId]: new Date() },
      createdAt: new Date()
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    if (forwardedFrom) {
      messageData.forwardedFrom = {
        originalSenderId: forwardedFrom.originalSenderId || null,
        originalSenderName: forwardedFrom.originalSenderName || null,
        originalConversationId: forwardedFrom.originalConversationId
          ? new ObjectId(forwardedFrom.originalConversationId)
          : null
      };
    }

    const result = await nativeDb.collection('staff_messages').insertOne(messageData);
    const messageId = result.insertedId;

    // Update conversation: last message + increment unread counts for others
    const unreadInc = {};
    convObj.participants.forEach(p => {
      if (p.userId !== auth.userId) {
        unreadInc[`unreadCounts.${p.userId}`] = 1;
      }
    });

    const encryptedPreview = await encryptionService.encrypt(
      content.length > 100 ? content.substring(0, 100) + '...' : content,
      'phi'
    );

    await nativeDb.collection('staff_conversations').updateOne({ _id: convId }, {
      $set: {
        lastMessage: {
          content: encryptedPreview,
          senderId: auth.userId,
          senderName,
          createdAt: new Date()
        },
        updatedAt: new Date()
      },
      $inc: unreadInc
    });

    // Build decrypted replyTo for socket/response
    let decryptedReplyTo = null;
    if (replyTo) {
      let replyContent = '';
      if (replyTo.content && typeof replyTo.content === 'object' && replyTo.content.encrypted) {
        try { replyContent = await encryptionService.decrypt(replyTo.content); } catch { replyContent = ''; }
      }
      decryptedReplyTo = {
        messageId: String(replyTo.messageId),
        senderId: replyTo.senderId,
        senderName: replyTo.senderName,
        content: replyContent,
        messageType: replyTo.messageType
      };
    }

    const responseMsg = {
      _id: messageId,
      conversationId: String(convId),
      senderId: auth.userId,
      senderName,
      content,
      messageType,
      readBy: messageData.readBy,
      createdAt: new Date(),
      replyTo: decryptedReplyTo,
      forwardedFrom: messageData.forwardedFrom || null,
      reactions: {}
    };

    // Emit to all participants via Socket.IO
    if (global.io) {
      convObj.participants.forEach(p => {
        global.io.to(`user_${p.userId}`).emit('staff_chat_new_message', {
          conversationId: String(convId),
          message: responseMsg
        });
      });
    }

    res.json({ success: true, message: responseMsg });
  } catch (error) {
    console.error('❌ Staff chat POST /messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// ─── PUT /conversations/:id/read — Mark conversation as read ───

router.put('/conversations/:id/read', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const convId = new ObjectId(req.params.id);
    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    // Verify participant
    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Reset unread count for this user (native DB)
    await nativeDb.collection('staff_conversations').updateOne(
      { _id: convId },
      { $set: { [`unreadCounts.${auth.userId}`]: 0 } }
    );

    // Mark all messages as read by this user (native DB)
    await nativeDb.collection('staff_messages').updateMany(
      { conversationId: convId, [`readBy.${auth.userId}`]: { $exists: false } },
      { $set: { [`readBy.${auth.userId}`]: new Date() } }
    );

    // Notify sender about read receipt via Socket.IO
    if (global.io) {
      conv.participants.forEach(p => {
        if (p.userId !== auth.userId) {
          global.io.to(`user_${p.userId}`).emit('staff_chat_read_receipt', {
            conversationId: String(convId),
            readBy: auth.userId,
            readAt: new Date()
          });
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Staff chat PUT /read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

// ─── GET /unread-count — Total unread across all conversations ───

router.get('/unread-count', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    const conversations = await nativeDb.collection('staff_conversations')
      .find({ 'participants.userId': auth.userId, isActive: true }, { projection: { unreadCounts: 1 } })
      .toArray();

    let total = 0;
    conversations.forEach(conv => {
      const count = conv.unreadCounts?.[auth.userId] || 0;
      total += count;
    });

    res.json({ success: true, unreadCount: total });
  } catch (error) {
    console.error('❌ Staff chat /unread-count error:', error);
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

// ─── GET /settings — Get my chat settings ───

router.get('/settings', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    let settings = await nativeDb.collection('staff_chat_settings').findOne({ userId: auth.userId });

    if (!settings) {
      // Create default settings
      settings = {
        userId: auth.userId,
        availability: 'online',
        statusText: '',
        lastSeen: null,
        readReceiptsEnabled: true,
        notificationSound: true,
        desktopNotifications: true,
        theme: 'dark',
        profileImage: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await nativeDb.collection('staff_chat_settings').insertOne(settings);
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('❌ Staff chat GET /settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// ─── PUT /settings — Update availability, statusText, preferences ───

router.put('/settings', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const allowedFields = ['availability', 'statusText', 'readReceiptsEnabled', 'notificationSound', 'desktopNotifications', 'theme'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'statusText') {
          updates[field] = String(req.body[field]).substring(0, 100);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    updates.updatedAt = new Date();

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    await nativeDb.collection('staff_chat_settings').updateOne(
      { userId: auth.userId },
      { $set: updates },
      { upsert: true }
    );

    // Broadcast status change to practice room via Socket.IO
    if (global.io && (updates.availability || updates.statusText !== undefined)) {
      const practiceId = auth.practiceSubdomain;
      const fullSettings = await nativeDb.collection('staff_chat_settings').findOne({ userId: auth.userId });
      global.io.to(`practice_chat_${practiceId}`).emit('staff_chat_status_change', {
        userId: auth.userId,
        availability: fullSettings?.availability || 'online',
        statusText: fullSettings?.statusText || ''
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Staff chat PUT /settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// ─── POST /settings/profile-image — Upload profile image (own only) ───

router.post('/settings/profile-image', profileImageUpload.single('profileImage'), async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    // Convert to base64 data URI
    const base64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${base64}`;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    await nativeDb.collection('staff_chat_settings').updateOne(
      { userId: auth.userId },
      { $set: { profileImage: dataUri, updatedAt: new Date() } },
      { upsert: true }
    );

    // Broadcast profile image change so others see it immediately
    if (global.io) {
      const practiceId = auth.practiceSubdomain;
      global.io.to(`practice_chat_${practiceId}`).emit('staff_chat_profile_image_change', {
        userId: auth.userId,
        profileImage: dataUri
      });
    }

    res.json({ success: true, profileImage: dataUri });
  } catch (error) {
    console.error('❌ Staff chat POST /settings/profile-image error:', error);
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to upload profile image' });
  }
});

// ─── DELETE /settings/profile-image — Remove profile image ───

router.delete('/settings/profile-image', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    await nativeDb.collection('staff_chat_settings').updateOne(
      { userId: auth.userId },
      { $set: { profileImage: null, updatedAt: new Date() } }
    );

    // Broadcast removal
    if (global.io) {
      const practiceId = auth.practiceSubdomain;
      global.io.to(`practice_chat_${practiceId}`).emit('staff_chat_profile_image_change', {
        userId: auth.userId,
        profileImage: null
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Staff chat DELETE /settings/profile-image error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove profile image' });
  }
});

// ─── GET /user-statuses — All users' availability + statusText + lastSeen ───

router.get('/user-statuses', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    const allSettings = await nativeDb.collection('staff_chat_settings')
      .find({}, { projection: { userId: 1, availability: 1, statusText: 1, lastSeen: 1, profileImage: 1 } })
      .toArray();

    const statuses = {};
    allSettings.forEach(s => {
      statuses[s.userId] = {
        availability: s.availability || 'online',
        statusText: s.statusText || '',
        lastSeen: s.lastSeen || null,
        profileImage: s.profileImage || null
      };
    });

    res.json({ success: true, statuses });
  } catch (error) {
    console.error('❌ Staff chat GET /user-statuses error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user statuses' });
  }
});

// ─── POST /conversations/:id/messages/:msgId/react — Toggle emoji reaction ───

router.post('/conversations/:id/messages/:msgId/react', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const { emoji } = req.body;
    if (!emoji) {
      return res.status(400).json({ success: false, error: 'Emoji required' });
    }

    const convId = new ObjectId(req.params.id);
    const msgId = new ObjectId(req.params.msgId);

    // Verify participant
    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(403).json({ success: false, error: 'Not a participant' });
    }

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    // Check if user already reacted with this emoji
    const msg = await nativeDb.collection('staff_messages').findOne({ _id: msgId, conversationId: convId });
    if (!msg) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    const reactions = msg.reactions instanceof Map ? Object.fromEntries(msg.reactions) : (msg.reactions || {});
    const usersForEmoji = reactions[emoji] || [];
    const alreadyReacted = usersForEmoji.includes(auth.userId);
    let action;

    if (alreadyReacted) {
      // Remove reaction
      await nativeDb.collection('staff_messages').updateOne(
        { _id: msgId },
        { $pull: { [`reactions.${emoji}`]: auth.userId } }
      );
      action = 'removed';
    } else {
      // Add reaction
      await nativeDb.collection('staff_messages').updateOne(
        { _id: msgId },
        { $addToSet: { [`reactions.${emoji}`]: auth.userId } }
      );
      action = 'added';
    }

    // Broadcast to participants
    if (global.io) {
      conv.participants.forEach(p => {
        global.io.to(`user_${p.userId}`).emit('staff_chat_reaction', {
          conversationId: String(convId),
          messageId: String(msgId),
          emoji,
          userId: auth.userId,
          action
        });
      });
    }

    res.json({ success: true, action });
  } catch (error) {
    console.error('❌ Staff chat POST /react error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle reaction' });
  }
});

// ─── DELETE /conversations/:id/messages/:msgId — Delete for me ───

router.delete('/conversations/:id/messages/:msgId', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const convId = new ObjectId(req.params.id);
    const msgId = new ObjectId(req.params.msgId);

    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(403).json({ success: false, error: 'Not a participant' });
    }

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    await nativeDb.collection('staff_messages').updateOne(
      { _id: msgId, conversationId: convId },
      { $addToSet: { deletedFor: auth.userId } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Staff chat DELETE /messages/:msgId error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// ─── DELETE /conversations/:id/messages/:msgId/everyone — Delete for everyone (15-min window) ───

router.delete('/conversations/:id/messages/:msgId/everyone', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const convId = new ObjectId(req.params.id);
    const msgId = new ObjectId(req.params.msgId);

    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(403).json({ success: false, error: 'Not a participant' });
    }

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    // Verify sender and 15-minute window
    const msg = await nativeDb.collection('staff_messages').findOne({ _id: msgId, conversationId: convId });
    if (!msg) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (msg.senderId !== auth.userId) {
      return res.status(403).json({ success: false, error: 'Only the sender can delete for everyone' });
    }

    const ageMs = Date.now() - new Date(msg.createdAt).getTime();
    if (ageMs > 15 * 60 * 1000) {
      return res.status(400).json({ success: false, error: 'Can only delete within 15 minutes of sending' });
    }

    await nativeDb.collection('staff_messages').updateOne(
      { _id: msgId },
      {
        $set: {
          deletedForEveryone: true,
          deletedForEveryoneAt: new Date(),
          deletedForEveryoneBy: auth.userId
        }
      }
    );

    // Broadcast to participants
    if (global.io) {
      conv.participants.forEach(p => {
        global.io.to(`user_${p.userId}`).emit('staff_chat_message_deleted', {
          conversationId: String(convId),
          messageId: String(msgId),
          deletedForEveryone: true
        });
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Staff chat DELETE /messages/:msgId/everyone error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message for everyone' });
  }
});

// ─── PUT /conversations/:id/pin — Toggle pin (max 3) ───

router.put('/conversations/:id/pin', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const convId = new ObjectId(req.params.id);

    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    const pinnedBy = conv.pinnedBy instanceof Map ? Object.fromEntries(conv.pinnedBy) : (conv.pinnedBy || {});
    const isPinned = !!pinnedBy[auth.userId];

    if (isPinned) {
      // Unpin
      await nativeDb.collection('staff_conversations').updateOne(
        { _id: convId },
        { $unset: { [`pinnedBy.${auth.userId}`]: '' } }
      );
      res.json({ success: true, pinned: false });
    } else {
      // Check max 3 pins
      const allConvs = await nativeDb.collection('staff_conversations')
        .find({ 'participants.userId': auth.userId, isActive: true })
        .toArray();

      const pinCount = allConvs.filter(c => {
        const pb = c.pinnedBy instanceof Map ? Object.fromEntries(c.pinnedBy) : (c.pinnedBy || {});
        return !!pb[auth.userId];
      }).length;

      if (pinCount >= 3) {
        return res.status(400).json({ success: false, error: 'Maximum 3 pinned conversations' });
      }

      await nativeDb.collection('staff_conversations').updateOne(
        { _id: convId },
        { $set: { [`pinnedBy.${auth.userId}`]: new Date() } }
      );
      res.json({ success: true, pinned: true });
    }
  } catch (error) {
    console.error('❌ Staff chat PUT /pin error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle pin' });
  }
});

// ─── PUT /conversations/:id/mute — Mute/unmute with duration ───

router.put('/conversations/:id/mute', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const { duration } = req.body; // '8h' | '1w' | 'always' | 'unmute'
    const convId = new ObjectId(req.params.id);

    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    if (duration === 'unmute') {
      await nativeDb.collection('staff_conversations').updateOne(
        { _id: convId },
        { $unset: { [`mutedBy.${auth.userId}`]: '' } }
      );
      res.json({ success: true, muted: false });
    } else {
      let until = null;
      if (duration === '8h') {
        until = new Date(Date.now() + 8 * 60 * 60 * 1000);
      } else if (duration === '1w') {
        until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
      // 'always' → until stays null

      await nativeDb.collection('staff_conversations').updateOne(
        { _id: convId },
        { $set: { [`mutedBy.${auth.userId}`]: { until, mutedAt: new Date() } } }
      );
      res.json({ success: true, muted: true, until });
    }
  } catch (error) {
    console.error('❌ Staff chat PUT /mute error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle mute' });
  }
});

// ─── GET /conversations/:id/search?q=term — Search messages in conversation ───

router.get('/conversations/:id/search', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
    }

    const convId = new ObjectId(req.params.id);
    const conv = await findConversation(auth.practiceSubdomain, req.params.id, auth.userId);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;

    // Fetch messages and decrypt, then filter by search term
    const messages = await nativeDb.collection('staff_messages')
      .find({
        conversationId: convId,
        deletedForEveryone: { $ne: true },
        deletedFor: { $nin: [auth.userId] }
      })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const searchLower = q.toLowerCase();
    const results = [];

    for (const msg of messages) {
      let content = msg.content;
      if (content && typeof content === 'object' && content.encrypted) {
        try {
          content = await encryptionService.decrypt(content);
        } catch {
          continue;
        }
      }
      if (typeof content === 'string' && content.toLowerCase().includes(searchLower)) {
        results.push({
          _id: msg._id,
          senderId: msg.senderId,
          senderName: msg.senderName,
          content,
          createdAt: msg.createdAt,
          messageType: msg.messageType
        });
      }
      if (results.length >= 50) break;
    }

    res.json({ success: true, results: results.reverse() });
  } catch (error) {
    console.error('❌ Staff chat GET /search error:', error);
    res.status(500).json({ success: false, error: 'Failed to search messages' });
  }
});

// ─── GET /backup — Export all conversations (decrypted JSON) ───

router.get('/backup', async (req, res) => {
  try {
    const auth = await authenticateRequest(req, res);
    if (!auth) return;

    const db = await getPracticeDb(auth.practiceSubdomain);
    const nativeDb = db.db ? db.db : db;
    const conversations = await nativeDb.collection('staff_conversations')
      .find({ 'participants.userId': auth.userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const backup = [];

    for (const conv of conversations) {
      const convObj = { ...conv };

      // Fetch all messages for this conversation
      const messages = await nativeDb.collection('staff_messages')
        .find({ conversationId: convObj._id })
        .sort({ createdAt: 1 })
        .limit(100)
        .toArray();

      // Decrypt all messages
      const decryptedMessages = await Promise.all(messages.map(async (msg) => {
        const msgObj = { ...msg };
        if (msgObj.content && typeof msgObj.content === 'object' && msgObj.content.encrypted) {
          try {
            msgObj.content = await encryptionService.decrypt(msgObj.content);
          } catch {
            msgObj.content = '[Could not decrypt]';
          }
        }
        return {
          sender: msgObj.senderName,
          content: msgObj.content,
          type: msgObj.messageType,
          timestamp: msgObj.createdAt
        };
      }));

      // Decrypt last message preview
      if (convObj.lastMessage?.content && typeof convObj.lastMessage.content === 'object' && convObj.lastMessage.content.encrypted) {
        try {
          convObj.lastMessage.content = await encryptionService.decrypt(convObj.lastMessage.content);
        } catch {
          convObj.lastMessage.content = '[Encrypted]';
        }
      }

      backup.push({
        type: convObj.type,
        name: convObj.name || convObj.participants.map(p => p.displayName).join(', '),
        participants: convObj.participants.map(p => ({ name: p.displayName, role: p.role })),
        messages: decryptedMessages,
        exportedAt: new Date()
      });
    }

    res.json({
      success: true,
      backup,
      exportedAt: new Date(),
      exportedBy: auth.userId
    });
  } catch (error) {
    console.error('❌ Staff chat /backup error:', error);
    res.status(500).json({ success: false, error: 'Failed to export backup' });
  }
});

module.exports = router;
