import { useState, useEffect, useCallback, useRef } from 'react';
import secureApi from '../services/secureApiClient';

export function useStaffChat(socket, userId) {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState({});
  const [activeConversation, setActiveConversation] = useState(null);
  const [practiceUsers, setPracticeUsers] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'chat' | 'new-chat' | 'new-group' | 'settings'
  const [loading, setLoading] = useState(false);

  // New state for v2 features
  const [userStatuses, setUserStatuses] = useState({}); // { userId: { availability, statusText, lastSeen } }
  const [mySettings, setMySettings] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // message being replied to
  const [forwardingMessage, setForwardingMessage] = useState(null); // message being forwarded

  const activeConvRef = useRef(null);
  const typingTimeoutRef = useRef({});

  // Keep ref in sync
  useEffect(() => {
    activeConvRef.current = activeConversation;
  }, [activeConversation]);

  // ─── Socket.IO Event Listeners ───

  useEffect(() => {
    if (!socket || !userId) return;

    // Register online presence
    const practiceId = localStorage.getItem('practiceSubdomain') ||
      localStorage.getItem('practiceId') ||
      window.location.hostname.split('.')[0];

    const registerOnline = () => {
      socket.emit('staff_chat_online', { userId, practiceId });
      // Rejoin active conversation room if one is open
      if (activeConvRef.current) {
        socket.emit('staff_chat_join_conv', String(activeConvRef.current._id));
      }
    };

    // Register immediately
    registerOnline();

    // Re-register on socket reconnect (handles dropped connections)
    const handleConnect = () => {
      registerOnline();
    };
    socket.on('connect', handleConnect);

    // Re-register when browser tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket.connected) {
        registerOnline();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Online users list (initial) — now includes statuses
    const handleOnlineUsers = ({ users, statuses }) => {
      setOnlineUsers(new Set(users));
      if (statuses) {
        setUserStatuses(prev => ({ ...prev, ...statuses }));
      }
    };

    // User comes online — now includes availability + statusText
    const handleUserOnline = ({ userId: onlineId, availability, statusText }) => {
      setOnlineUsers(prev => new Set([...prev, onlineId]));
      if (availability || statusText !== undefined) {
        setUserStatuses(prev => ({
          ...prev,
          [onlineId]: {
            ...(prev[onlineId] || {}),
            availability: availability || 'online',
            statusText: statusText || ''
          }
        }));
      }
    };

    // User goes offline
    const handleUserOffline = ({ userId: offlineId }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(offlineId);
        return next;
      });
    };

    // New message received
    const handleNewMessage = ({ conversationId, message }) => {
      // Add to messages if we have this conversation loaded
      setMessages(prev => {
        const convMessages = prev[conversationId] || [];
        // Avoid duplicates
        if (convMessages.some(m => String(m._id) === String(message._id))) return prev;
        return { ...prev, [conversationId]: [...convMessages, message] };
      });

      // Update conversation list
      setConversations(prev => {
        const updated = prev.map(conv => {
          if (String(conv._id) === conversationId) {
            const convCopy = { ...conv };
            convCopy.lastMessage = {
              content: message.content,
              senderId: message.senderId,
              senderName: message.senderName,
              createdAt: message.createdAt
            };
            // Increment unread if not the active conversation
            if (message.senderId !== userId) {
              if (String(activeConvRef.current?._id) !== conversationId) {
                const currentCount = convCopy.unreadCounts?.[userId] || 0;
                convCopy.unreadCounts = { ...convCopy.unreadCounts, [userId]: currentCount + 1 };
              }
            }
            return convCopy;
          }
          return conv;
        });
        // Sort by last message time
        return updated.sort((a, b) => {
          const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
          const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
          return bTime - aTime;
        });
      });

      // Update total unread
      if (message.senderId !== userId && String(activeConvRef.current?._id) !== conversationId) {
        setTotalUnreadCount(prev => prev + 1);
      }
    };

    // New conversation created (group)
    const handleNewConversation = () => {
      loadConversations();
    };

    // Typing indicator
    const handleTyping = ({ conversationId, userId: typerId, userName, isTyping }) => {
      setTypingUsers(prev => {
        const convTyping = { ...(prev[conversationId] || {}) };
        if (isTyping) {
          convTyping[typerId] = userName;
        } else {
          delete convTyping[typerId];
        }
        return { ...prev, [conversationId]: convTyping };
      });
    };

    // Read receipt
    const handleReadReceipt = ({ conversationId, readBy, readAt }) => {
      setMessages(prev => {
        const convMessages = prev[conversationId];
        if (!convMessages) return prev;
        return {
          ...prev,
          [conversationId]: convMessages.map(msg => {
            if (msg.senderId === userId) {
              return {
                ...msg,
                readBy: { ...msg.readBy, [readBy]: readAt }
              };
            }
            return msg;
          })
        };
      });
    };

    // ─── New v2 socket listeners ───

    // Status change (availability/statusText)
    const handleStatusChange = ({ userId: changedId, availability, statusText }) => {
      setUserStatuses(prev => ({
        ...prev,
        [changedId]: { ...(prev[changedId] || {}), availability, statusText }
      }));

      // If appear_offline, remove from online users
      if (availability === 'appear_offline') {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          next.delete(changedId);
          return next;
        });
      }
    };

    // Profile image change
    const handleProfileImageChange = ({ userId: changedId, profileImage }) => {
      setUserStatuses(prev => ({
        ...prev,
        [changedId]: { ...(prev[changedId] || {}), profileImage }
      }));
    };

    // Emoji reaction update
    const handleReaction = ({ conversationId, messageId, emoji, userId: reactUserId, action }) => {
      setMessages(prev => {
        const convMessages = prev[conversationId];
        if (!convMessages) return prev;
        return {
          ...prev,
          [conversationId]: convMessages.map(msg => {
            if (String(msg._id) === messageId) {
              const reactions = { ...(msg.reactions || {}) };
              const users = [...(reactions[emoji] || [])];
              if (action === 'added' && !users.includes(reactUserId)) {
                users.push(reactUserId);
              } else if (action === 'removed') {
                const idx = users.indexOf(reactUserId);
                if (idx >= 0) users.splice(idx, 1);
              }
              if (users.length > 0) {
                reactions[emoji] = users;
              } else {
                delete reactions[emoji];
              }
              return { ...msg, reactions };
            }
            return msg;
          })
        };
      });
    };

    // Message deleted for everyone
    const handleMessageDeleted = ({ conversationId, messageId, deletedForEveryone }) => {
      if (deletedForEveryone) {
        setMessages(prev => {
          const convMessages = prev[conversationId];
          if (!convMessages) return prev;
          return {
            ...prev,
            [conversationId]: convMessages.map(msg => {
              if (String(msg._id) === messageId) {
                return { ...msg, content: null, deletedForEveryone: true };
              }
              return msg;
            })
          };
        });
      }
    };

    socket.on('staff_chat_online_users', handleOnlineUsers);
    socket.on('staff_user_online', handleUserOnline);
    socket.on('staff_user_offline', handleUserOffline);
    socket.on('staff_chat_new_message', handleNewMessage);
    socket.on('staff_chat_new_conversation', handleNewConversation);
    socket.on('staff_chat_typing', handleTyping);
    socket.on('staff_chat_read_receipt', handleReadReceipt);
    socket.on('staff_chat_status_change', handleStatusChange);
    socket.on('staff_chat_profile_image_change', handleProfileImageChange);
    socket.on('staff_chat_reaction', handleReaction);
    socket.on('staff_chat_message_deleted', handleMessageDeleted);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('staff_chat_online_users', handleOnlineUsers);
      socket.off('staff_user_online', handleUserOnline);
      socket.off('staff_user_offline', handleUserOffline);
      socket.off('staff_chat_new_message', handleNewMessage);
      socket.off('staff_chat_new_conversation', handleNewConversation);
      socket.off('staff_chat_typing', handleTyping);
      socket.off('staff_chat_read_receipt', handleReadReceipt);
      socket.off('staff_chat_status_change', handleStatusChange);
      socket.off('staff_chat_profile_image_change', handleProfileImageChange);
      socket.off('staff_chat_reaction', handleReaction);
      socket.off('staff_chat_message_deleted', handleMessageDeleted);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, userId]);

  // ─── Auto-load practice users on init ───

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await secureApi.get('/api/staff-chat/users');
        if (res.success) setPracticeUsers(res.users);
      } catch (err) {
        console.error('Failed to auto-load practice users:', err);
      }
    })();
  }, [userId]);

  // ─── API Methods ───

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await secureApi.get('/api/staff-chat/conversations');
      if (res.success) {
        setConversations(res.conversations);
        let total = 0;
        res.conversations.forEach(conv => {
          const count = conv.unreadCounts?.[userId] || 0;
          total += count;
        });
        setTotalUnreadCount(total);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMessages = useCallback(async (convId, before) => {
    try {
      const url = before
        ? `/api/staff-chat/conversations/${convId}/messages?before=${before}`
        : `/api/staff-chat/conversations/${convId}/messages`;
      const res = await secureApi.get(url);
      if (res.success) {
        if (before) {
          setMessages(prev => ({
            ...prev,
            [convId]: [...res.messages, ...(prev[convId] || [])]
          }));
        } else {
          setMessages(prev => ({ ...prev, [convId]: res.messages }));
        }
      }
      return res.messages || [];
    } catch (err) {
      console.error('Failed to load messages:', err);
      return [];
    }
  }, []);

  const sendMessage = useCallback(async (convId, content, options = {}) => {
    try {
      const body = { content };
      if (options.replyToMessageId) body.replyToMessageId = options.replyToMessageId;
      if (options.forwardedFrom) body.forwardedFrom = options.forwardedFrom;

      const res = await secureApi.post(`/api/staff-chat/conversations/${convId}/messages`, body);
      if (res.success && res.message) {
        setMessages(prev => {
          const convMessages = prev[convId] || [];
          if (convMessages.some(m => String(m._id) === String(res.message._id))) return prev;
          return { ...prev, [convId]: [...convMessages, res.message] };
        });
        setConversations(prev => {
          const updated = prev.map(conv => {
            if (String(conv._id) === convId) {
              return {
                ...conv,
                lastMessage: {
                  content: res.message.content,
                  senderId: res.message.senderId,
                  senderName: res.message.senderName,
                  createdAt: res.message.createdAt
                }
              };
            }
            return conv;
          });
          return updated.sort((a, b) => {
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
            return bTime - aTime;
          });
        });
        return res.message;
      }
      return null;
    } catch (err) {
      console.error('Failed to send message:', err);
      return null;
    }
  }, []);

  const startDirectChat = useCallback(async (recipientId) => {
    try {
      const res = await secureApi.post('/api/staff-chat/conversations', {
        type: 'direct',
        participantIds: [recipientId]
      });
      if (res.success) {
        if (!res.existing) {
          setConversations(prev => [res.conversation, ...prev]);
        }
        return res.conversation;
      }
      return null;
    } catch (err) {
      console.error('Failed to start direct chat:', err);
      return null;
    }
  }, []);

  const createGroup = useCallback(async (name, participantIds) => {
    try {
      const res = await secureApi.post('/api/staff-chat/conversations', {
        type: 'group',
        name,
        participantIds
      });
      if (res.success) {
        setConversations(prev => [res.conversation, ...prev]);
        return res.conversation;
      }
      return null;
    } catch (err) {
      console.error('Failed to create group:', err);
      return null;
    }
  }, []);

  const updateGroup = useCallback(async (convId, updates) => {
    try {
      const res = await secureApi.put(`/api/staff-chat/conversations/${convId}`, updates);
      if (res.success) {
        loadConversations();
      }
      return res.success;
    } catch (err) {
      console.error('Failed to update group:', err);
      return false;
    }
  }, [loadConversations]);

  const markAsRead = useCallback(async (convId) => {
    try {
      await secureApi.put(`/api/staff-chat/conversations/${convId}/read`, {});
      setConversations(prev =>
        prev.map(conv => {
          if (String(conv._id) === convId) {
            return { ...conv, unreadCounts: { ...conv.unreadCounts, [userId]: 0 } };
          }
          return conv;
        })
      );
      setTotalUnreadCount(prev => {
        const convUnread = conversations.find(c => String(c._id) === convId)?.unreadCounts?.[userId] || 0;
        return Math.max(0, prev - convUnread);
      });
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, [userId, conversations]);

  const loadPracticeUsers = useCallback(async () => {
    try {
      const res = await secureApi.get('/api/staff-chat/users');
      if (res.success) {
        setPracticeUsers(res.users);
      }
    } catch (err) {
      console.error('Failed to load practice users:', err);
    }
  }, []);

  const sendTyping = useCallback((convId, isTyping) => {
    if (!socket || !userId) return;

    if (typingTimeoutRef.current[convId]) {
      clearTimeout(typingTimeoutRef.current[convId]);
    }

    socket.emit('staff_chat_typing', {
      conversationId: convId,
      userId,
      userName: '',
      isTyping
    });

    if (isTyping) {
      typingTimeoutRef.current[convId] = setTimeout(() => {
        socket.emit('staff_chat_typing', {
          conversationId: convId,
          userId,
          userName: '',
          isTyping: false
        });
      }, 3000);
    }
  }, [socket, userId]);

  const downloadBackup = useCallback(async () => {
    try {
      const res = await secureApi.get('/api/staff-chat/backup');
      if (res.success) {
        const blob = new Blob([JSON.stringify(res.backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `staff-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download backup:', err);
    }
  }, []);

  // ─── New v2 API Methods ───

  const loadSettings = useCallback(async () => {
    try {
      const res = await secureApi.get('/api/staff-chat/settings');
      if (res.success) {
        setMySettings(res.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }, []);

  const updateSettings = useCallback(async (updates) => {
    try {
      const res = await secureApi.put('/api/staff-chat/settings', updates);
      if (res.success) {
        setMySettings(prev => ({ ...prev, ...updates }));
      }
      return res.success;
    } catch (err) {
      console.error('Failed to update settings:', err);
      return false;
    }
  }, []);

  const loadUserStatuses = useCallback(async () => {
    try {
      const res = await secureApi.get('/api/staff-chat/user-statuses');
      if (res.success) {
        setUserStatuses(res.statuses);
      }
    } catch (err) {
      console.error('Failed to load user statuses:', err);
    }
  }, []);

  const uploadProfileImage = useCallback(async (file) => {
    try {
      const formData = new FormData();
      formData.append('profileImage', file);
      const res = await secureApi.post('/api/staff-chat/settings/profile-image', formData);
      if (res.success) {
        setMySettings(prev => ({ ...prev, profileImage: res.profileImage }));
      }
      return res.success;
    } catch (err) {
      console.error('Failed to upload profile image:', err);
      return false;
    }
  }, []);

  const removeProfileImage = useCallback(async () => {
    try {
      const res = await secureApi.delete('/api/staff-chat/settings/profile-image');
      if (res.success) {
        setMySettings(prev => ({ ...prev, profileImage: null }));
      }
      return res.success;
    } catch (err) {
      console.error('Failed to remove profile image:', err);
      return false;
    }
  }, []);

  const reactToMessage = useCallback(async (convId, msgId, emoji) => {
    try {
      const res = await secureApi.post(`/api/staff-chat/conversations/${convId}/messages/${msgId}/react`, { emoji });
      return res.success;
    } catch (err) {
      console.error('Failed to react:', err);
      return false;
    }
  }, []);

  const deleteForMe = useCallback(async (convId, msgId) => {
    try {
      const res = await secureApi.delete(`/api/staff-chat/conversations/${convId}/messages/${msgId}`);
      if (res.success) {
        // Remove from local state
        setMessages(prev => {
          const convMessages = prev[convId];
          if (!convMessages) return prev;
          return {
            ...prev,
            [convId]: convMessages.filter(m => String(m._id) !== msgId)
          };
        });
      }
      return res.success;
    } catch (err) {
      console.error('Failed to delete for me:', err);
      return false;
    }
  }, []);

  const deleteForEveryone = useCallback(async (convId, msgId) => {
    try {
      const res = await secureApi.delete(`/api/staff-chat/conversations/${convId}/messages/${msgId}/everyone`);
      return res.success;
    } catch (err) {
      console.error('Failed to delete for everyone:', err);
      return false;
    }
  }, []);

  const pinConversation = useCallback(async (convId) => {
    try {
      const res = await secureApi.put(`/api/staff-chat/conversations/${convId}/pin`, {});
      if (res.success) {
        setConversations(prev =>
          prev.map(conv => {
            if (String(conv._id) === convId) {
              const pinnedBy = { ...(conv.pinnedBy || {}) };
              if (res.pinned) {
                pinnedBy[userId] = new Date().toISOString();
              } else {
                delete pinnedBy[userId];
              }
              return { ...conv, pinnedBy };
            }
            return conv;
          })
        );
      }
      return res;
    } catch (err) {
      console.error('Failed to pin:', err);
      return { success: false };
    }
  }, [userId]);

  const muteConversation = useCallback(async (convId, duration) => {
    try {
      const res = await secureApi.put(`/api/staff-chat/conversations/${convId}/mute`, { duration });
      if (res.success) {
        setConversations(prev =>
          prev.map(conv => {
            if (String(conv._id) === convId) {
              const mutedBy = { ...(conv.mutedBy || {}) };
              if (res.muted) {
                mutedBy[userId] = { until: res.until, mutedAt: new Date().toISOString() };
              } else {
                delete mutedBy[userId];
              }
              return { ...conv, mutedBy };
            }
            return conv;
          })
        );
      }
      return res;
    } catch (err) {
      console.error('Failed to mute:', err);
      return { success: false };
    }
  }, [userId]);

  const searchMessages = useCallback(async (convId, query) => {
    try {
      const res = await secureApi.get(`/api/staff-chat/conversations/${convId}/search?q=${encodeURIComponent(query)}`);
      if (res.success) {
        return res.results;
      }
      return [];
    } catch (err) {
      console.error('Failed to search messages:', err);
      return [];
    }
  }, []);

  // Open a conversation
  const openConversation = useCallback(async (conv) => {
    setActiveConversation(conv);
    setView('chat');
    setReplyingTo(null);
    setForwardingMessage(null);

    if (socket) {
      socket.emit('staff_chat_join_conv', String(conv._id));
    }

    await loadMessages(String(conv._id));

    if (conv.unreadCounts?.[userId] > 0) {
      markAsRead(String(conv._id));
    }
  }, [socket, userId, loadMessages, markAsRead]);

  // Close conversation
  const closeConversation = useCallback(() => {
    if (socket && activeConversation) {
      socket.emit('staff_chat_leave_conv', String(activeConversation._id));
    }
    setActiveConversation(null);
    setReplyingTo(null);
    setForwardingMessage(null);
    setView('list');
  }, [socket, activeConversation]);

  return {
    // State
    conversations,
    messages,
    onlineUsers,
    totalUnreadCount,
    typingUsers,
    activeConversation,
    practiceUsers,
    view,
    loading,
    userStatuses,
    mySettings,
    replyingTo,
    forwardingMessage,

    // Methods
    loadConversations,
    loadMessages,
    sendMessage,
    startDirectChat,
    createGroup,
    updateGroup,
    markAsRead,
    loadPracticeUsers,
    sendTyping,
    downloadBackup,
    openConversation,
    closeConversation,
    setView,
    setActiveConversation,

    // v2 methods
    loadSettings,
    updateSettings,
    loadUserStatuses,
    reactToMessage,
    deleteForMe,
    deleteForEveryone,
    pinConversation,
    muteConversation,
    searchMessages,
    uploadProfileImage,
    removeProfileImage,
    setReplyingTo,
    setForwardingMessage
  };
}
