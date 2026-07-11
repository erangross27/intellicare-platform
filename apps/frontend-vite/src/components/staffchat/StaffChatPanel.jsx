import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import './StaffChatPanel.css';
import EmojiPicker, { QUICK_REACTIONS } from './EmojiPicker';
import { roleLabel, canonicalRole, primaryRole } from '../../config/roleConfig';

const GroupInfoPanel = lazy(() => import('./GroupInfoPanel'));

const t = (lang, en, he) => lang === 'he' ? he : en;

// ─── Helpers ───

function getInitials(name) {
  const parts = (name || '?').split(' ').filter(Boolean);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name?.[0] || '?').toUpperCase();
}

function timeAgo(dateStr, lang) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return t(lang, 'now', 'עכשיו');
  if (diff < 3600) return `${Math.floor(diff / 60)}${t(lang, 'm', 'ד')}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${t(lang, 'h', 'ש')}`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}${t(lang, 'd', 'י')}`;
  return d.toLocaleDateString();
}

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function shouldShowDate(current, previous) {
  if (!previous) return true;
  return new Date(current).toDateString() !== new Date(previous).toDateString();
}

function formatDate(dateStr, lang) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t(lang, 'Today', 'היום');
  if (d.toDateString() === yesterday.toDateString()) return t(lang, 'Yesterday', 'אתמול');
  return d.toLocaleDateString();
}

function formatLastSeen(dateStr, lang) {
  if (!dateStr) return t(lang, 'Offline', 'לא מחובר');
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return t(lang, `Last seen today at ${timeStr}`, `נראה לאחרונה היום ב-${timeStr}`);
  return t(lang, `Last seen ${d.toLocaleDateString()} at ${timeStr}`, `נראה לאחרונה ${d.toLocaleDateString()} ב-${timeStr}`);
}

// Message text formatting: *bold*, _italic_, ~strikethrough~
function formatMessageText(text) {
  if (!text || typeof text !== 'string') return text;
  const parts = [];
  let remaining = text;
  let key = 0;

  // Process formatting patterns
  const regex = /(\*([^*]+)\*)|(_([^_]+)_)|(~([^~]+)~)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // *bold*
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      // _italic_
      parts.push(<em key={key++}>{match[4]}</em>);
    } else if (match[5]) {
      // ~strikethrough~
      parts.push(<s key={key++}>{match[6]}</s>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// Availability colors
function getAvailabilityColor(availability) {
  switch (availability) {
    case 'online': return '#22c55e';
    case 'busy': return '#f59e0b';
    case 'away': return '#eab308';
    case 'appear_offline': return '#6b7280';
    default: return '#22c55e';
  }
}

function getAvailabilityLabel(availability, lang) {
  switch (availability) {
    case 'online': return t(lang, 'Online', 'מחובר');
    case 'busy': return t(lang, 'Busy', 'עסוק');
    case 'away': return t(lang, 'Away', 'לא נמצא');
    case 'appear_offline': return t(lang, 'Appear Offline', 'נראה כלא מחובר');
    default: return t(lang, 'Online', 'מחובר');
  }
}

// ─── Checkmark Component ───

function Checkmarks({ message, userId, participantCount }) {
  if (message.senderId !== userId) return null;
  const readCount = message.readBy ? Object.keys(message.readBy).length : 0;
  const allRead = readCount >= participantCount;
  return (
    <span className={`sc-checkmarks ${allRead ? 'read' : 'delivered'}`}>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <path d="M1 5.5L4.5 9L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 5.5L8.5 9L15 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

// ─── Main Component ───

export default function StaffChatPanel({
  userId,
  userName,
  userRole,
  language,
  socket,
  onClose,
  // From useStaffChat hook
  conversations,
  messages,
  onlineUsers,
  totalUnreadCount,
  typingUsers,
  activeConversation,
  practiceUsers,
  view,
  loading,
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
  // v2 props
  userStatuses = {},
  mySettings,
  replyingTo,
  forwardingMessage,
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
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [inputText, setInputText] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [leftTab, setLeftTab] = useState('contacts'); // 'contacts' | 'chats' | 'new-group'
  // minimized state removed - sidebar icon controls visibility

  // v2 UI state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, message }
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showConvContextMenu, setShowConvContextMenu] = useState(null); // { x, y, conv }
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState(null);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [showForwardPicker, setShowForwardPicker] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const profileImageInputRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const dir = language === 'he' ? 'rtl' : 'ltr';

  // ─── Draggable panel ───
  const handleDragStart = useCallback((e) => {
    if (e.target.closest('.sc-input-field, .sc-send-btn, .sc-close-btn, button, input, textarea')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
    e.preventDefault();

    const handleDragMove = (me) => {
      if (!dragRef.current.dragging) return;
      const dx = me.clientX - dragRef.current.startX;
      const dy = me.clientY - dragRef.current.startY;
      panel.style.left = (dragRef.current.origX + dx) + 'px';
      panel.style.top = (dragRef.current.origY + dy) + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };
    const handleDragEnd = () => {
      dragRef.current.dragging = false;
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, []);

  // Get profile image for a user from userStatuses or mySettings (for self)
  const getProfileImage = useCallback((uid) => {
    if (uid === userId && mySettings?.profileImage) return mySettings.profileImage;
    return userStatuses[uid]?.profileImage || null;
  }, [userId, mySettings, userStatuses]);

  // Handle profile image file selection
  const handleProfileImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert(t(language, 'Image must be under 500KB', 'התמונה חייבת להיות קטנה מ-500KB'));
      return;
    }
    if (uploadProfileImage) {
      await uploadProfileImage(file);
    }
    // Reset input so same file can be re-selected
    if (profileImageInputRef.current) profileImageInputRef.current.value = '';
  }, [language, uploadProfileImage]);

  // Render avatar with profile image support
  const renderAvatar = useCallback((uid, name, role, style = {}) => {
    const profileImg = getProfileImage(uid);
    if (profileImg) {
      return (
        <div className={`sc-avatar sc-avatar-${role}`} style={style}>
          <img src={profileImg} alt="" className="sc-avatar-img" />
        </div>
      );
    }
    return (
      <div className={`sc-avatar sc-avatar-${role}`} style={style}>
        {getInitials(name)}
      </div>
    );
  }, [getProfileImage]);

  // Load conversations, users, settings on mount
  useEffect(() => {
    loadConversations();
    loadPracticeUsers();
    if (loadSettings) loadSettings();
    if (loadUserStatuses) loadUserStatuses();
  }, [loadConversations, loadPracticeUsers, loadSettings, loadUserStatuses]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatEndRef.current && activeConversation) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeConversation]);

  // Focus input when conversation opens
  useEffect(() => {
    if (activeConversation && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConversation]);

  // Close context menus on outside click
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setShowConvContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // ─── Sorted conversations (pinned first) ───

  const sortedConversations = useMemo(() => {
    const filtered = searchTerm.trim()
      ? conversations.filter(conv => {
          const convName = conv.type === 'group'
            ? conv.name
            : conv.participants?.find(p => p.userId !== userId)?.displayName || '';
          return convName.toLowerCase().includes(searchTerm.toLowerCase());
        })
      : conversations;

    return [...filtered].sort((a, b) => {
      const aPinned = !!(a.pinnedBy && a.pinnedBy[userId]);
      const bPinned = !!(b.pinnedBy && b.pinnedBy[userId]);
      if (aPinned !== bPinned) return bPinned ? 1 : -1;
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
      return bTime - aTime;
    });
  }, [conversations, searchTerm, userId]);

  // ─── All users (excluding self), sorted online first ───

  const sortedUsers = useMemo(() => {
    let users = practiceUsers.filter(u => u._id !== userId);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      users = users.filter(u => u.displayName.toLowerCase().includes(term));
    }
    return users.sort((a, b) => {
      const aOnline = onlineUsers.has(a._id) ? 1 : 0;
      const bOnline = onlineUsers.has(b._id) ? 1 : 0;
      if (bOnline !== aOnline) return bOnline - aOnline;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }, [practiceUsers, userId, searchTerm, onlineUsers]);

  // ─── Grouped users for new group ───

  const groupedUsers = useMemo(() => {
    const filtered = practiceUsers.filter(u => {
      if (u._id === userId) return false;
      if (!searchTerm.trim()) return true;
      return u.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    });
    const groups = {
      doctor: { title: t(language, 'Doctors', 'רופאים'), users: [] },
      nurse: { title: t(language, 'Nurses', 'אחיות'), users: [] },
      admin: { title: t(language, 'Admins', 'מנהלים'), users: [] },
      user: { title: t(language, 'Users', 'משתמשים'), users: [] }
    };
    filtered.forEach(u => {
      const role = primaryRole(u.roles || [u.role]);
      (groups[role] || groups.user).users.push(u);
    });
    return Object.values(groups).filter(g => g.users.length > 0);
  }, [practiceUsers, userId, searchTerm, language]);

  // ─── Current conversation data ───

  const currentMessages = activeConversation
    ? (messages[String(activeConversation._id)] || [])
    : [];

  const currentTyping = activeConversation
    ? (typingUsers[String(activeConversation._id)] || {})
    : {};

  const typingNames = Object.values(currentTyping).filter(Boolean);
  const participantCount = activeConversation?.participants?.length || 2;

  // ─── Handlers ───

  const handleSendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !activeConversation) return;
    setInputText('');

    const options = {};
    if (replyingTo) {
      options.replyToMessageId = String(replyingTo._id);
    }
    if (forwardingMessage) {
      options.forwardedFrom = {
        originalSenderId: forwardingMessage.senderId,
        originalSenderName: forwardingMessage.senderName,
        originalConversationId: forwardingMessage.conversationId
      };
    }

    await sendMessage(String(activeConversation._id), text, options);
    sendTyping(String(activeConversation._id), false);
    if (setReplyingTo) setReplyingTo(null);
    if (setForwardingMessage) setForwardingMessage(null);
  }, [inputText, activeConversation, sendMessage, sendTyping, replyingTo, forwardingMessage, setReplyingTo, setForwardingMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleInputChange = useCallback((e) => {
    setInputText(e.target.value);
    if (activeConversation && e.target.value.trim()) {
      sendTyping(String(activeConversation._id), true);
    }
  }, [activeConversation, sendTyping]);

  const handleUserClick = useCallback(async (recipientId) => {
    const conv = await startDirectChat(recipientId);
    if (conv) {
      openConversation(conv);
    }
  }, [startDirectChat, openConversation]);

  const handleCreateGroup = useCallback(async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const conv = await createGroup(groupName.trim(), selectedUsers);
    if (conv) {
      openConversation(conv);
      setLeftTab('chats');
      setSelectedUsers([]);
      setGroupName('');
    }
  }, [groupName, selectedUsers, createGroup, openConversation]);

  const toggleUserSelect = useCallback((uid) => {
    setSelectedUsers(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  }, []);

  const getConvName = useCallback((conv) => {
    if (conv.type === 'group') return conv.name || 'Group';
    const other = conv.participants?.find(p => p.userId !== userId);
    return other?.displayName || 'Unknown';
  }, [userId]);

  const getConvRole = useCallback((conv) => {
    if (conv.type === 'group') return 'group';
    const other = conv.participants?.find(p => p.userId !== userId);
    return canonicalRole(other?.role);
  }, [userId]);

  const getConvOnline = useCallback((conv) => {
    if (conv.type === 'group') return false;
    const other = conv.participants?.find(p => p.userId !== userId);
    return other ? onlineUsers.has(other.userId) : false;
  }, [userId, onlineUsers]);

  const getOtherUserId = useCallback((conv) => {
    if (conv.type === 'group') return null;
    return conv.participants?.find(p => p.userId !== userId)?.userId || null;
  }, [userId]);

  // ─── Context Menu Handlers ───

  const handleMessageContextMenu = useCallback((e, msg) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
  }, []);

  const handleConvContextMenu = useCallback((e, conv) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConvContextMenu({ x: e.clientX, y: e.clientY, conv });
  }, []);

  const handleReply = useCallback((msg) => {
    if (setReplyingTo) setReplyingTo(msg);
    setContextMenu(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [setReplyingTo]);

  const handleForward = useCallback((msg) => {
    if (setForwardingMessage) setForwardingMessage(msg);
    setShowForwardPicker(true);
    setContextMenu(null);
  }, [setForwardingMessage]);

  const handleForwardTo = useCallback(async (targetConv) => {
    if (!forwardingMessage) return;
    const content = forwardingMessage.content || '';
    await sendMessage(String(targetConv._id), content, {
      forwardedFrom: {
        originalSenderId: forwardingMessage.senderId,
        originalSenderName: forwardingMessage.senderName,
        originalConversationId: String(forwardingMessage.conversationId || activeConversation?._id)
      }
    });
    if (setForwardingMessage) setForwardingMessage(null);
    setShowForwardPicker(false);
  }, [forwardingMessage, sendMessage, activeConversation, setForwardingMessage]);

  const handleDeleteForMe = useCallback(async (msg) => {
    if (deleteForMe) await deleteForMe(String(activeConversation._id), String(msg._id));
    setContextMenu(null);
  }, [deleteForMe, activeConversation]);

  const handleDeleteForEveryone = useCallback(async (msg) => {
    if (deleteForEveryone) await deleteForEveryone(String(activeConversation._id), String(msg._id));
    setContextMenu(null);
  }, [deleteForEveryone, activeConversation]);

  const handleReact = useCallback(async (msg, emoji) => {
    if (reactToMessage) await reactToMessage(String(activeConversation._id), String(msg._id), emoji);
    setHoveredMsgId(null);
  }, [reactToMessage, activeConversation]);

  // Chat search
  const handleChatSearch = useCallback(async () => {
    if (!chatSearchTerm.trim() || !activeConversation || !searchMessages) return;
    const results = await searchMessages(String(activeConversation._id), chatSearchTerm);
    setChatSearchResults(results);
  }, [chatSearchTerm, activeConversation, searchMessages]);

  useEffect(() => {
    if (!chatSearchTerm.trim()) {
      setChatSearchResults(null);
      return;
    }
    const timer = setTimeout(handleChatSearch, 400);
    return () => clearTimeout(timer);
  }, [chatSearchTerm, handleChatSearch]);

  // ─── Settings View ───

  const renderSettingsView = () => (
    <div className="sc-right-panel sc-settings-panel">
      <div className="sc-chat-header">
        <button className="sc-back-btn" onClick={() => setView('list')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="sc-chat-header-title">{t(language, 'Settings', 'הגדרות')}</span>
      </div>
      <div className="sc-settings-content">
        {/* Profile Image */}
        <div className="sc-settings-section sc-profile-section">
          <div className="sc-settings-label">{t(language, 'Profile Photo', 'תמונת פרופיל')}</div>
          <div className="sc-profile-image-row">
            <div
              className={`sc-avatar sc-avatar-${canonicalRole(userRole)} sc-profile-avatar`}
              onClick={() => profileImageInputRef.current?.click()}
            >
              {mySettings?.profileImage ? (
                <img src={mySettings.profileImage} alt="" className="sc-avatar-img" />
              ) : getInitials(userName)}
              <div className="sc-profile-overlay">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            </div>
            <div className="sc-profile-actions">
              <button
                className="sc-settings-backup-btn"
                onClick={() => profileImageInputRef.current?.click()}
              >
                {t(language, 'Upload Photo', 'העלה תמונה')}
              </button>
              {mySettings?.profileImage && (
                <button
                  className="sc-settings-backup-btn sc-remove-photo-btn"
                  onClick={() => removeProfileImage && removeProfileImage()}
                >
                  {t(language, 'Remove', 'הסר')}
                </button>
              )}
            </div>
          </div>
          <input
            ref={profileImageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleProfileImageUpload}
          />
          <div className="sc-settings-hint">{t(language, 'Max 500KB. JPG, PNG, or GIF.', 'עד 500KB. JPG, PNG או GIF.')}</div>
        </div>

        {/* Availability */}
        <div className="sc-settings-section">
          <div className="sc-settings-label">{t(language, 'Availability', 'זמינות')}</div>
          {['online', 'busy', 'away', 'appear_offline'].map(status => (
            <label key={status} className={`sc-settings-radio ${mySettings?.availability === status ? 'active' : ''}`}>
              <input
                type="radio"
                name="availability"
                checked={mySettings?.availability === status}
                onChange={() => updateSettings && updateSettings({ availability: status })}
              />
              <span className="sc-status-dot" style={{ background: getAvailabilityColor(status) }} />
              {getAvailabilityLabel(status, language)}
            </label>
          ))}
        </div>

        {/* Status text */}
        <div className="sc-settings-section">
          <div className="sc-settings-label">{t(language, 'Status Text', 'טקסט סטטוס')}</div>
          <input
            className="sc-settings-input"
            placeholder={t(language, 'e.g., In surgery, On call, Back at 3pm', 'לדוגמה: בניתוח, כוננות, חוזר ב-15:00')}
            value={mySettings?.statusText || ''}
            maxLength={100}
            onChange={e => updateSettings && updateSettings({ statusText: e.target.value })}
          />
          <div className="sc-settings-hint">{mySettings?.statusText?.length || 0}/100</div>
        </div>

        {/* Toggles */}
        <div className="sc-settings-section">
          <div className="sc-settings-label">{t(language, 'Preferences', 'העדפות')}</div>
          <label className="sc-settings-toggle">
            <span>{t(language, 'Read Receipts', 'אישורי קריאה')}</span>
            <input
              type="checkbox"
              checked={mySettings?.readReceiptsEnabled !== false}
              onChange={e => updateSettings && updateSettings({ readReceiptsEnabled: e.target.checked })}
            />
            <span className="sc-toggle-slider" />
          </label>
          <label className="sc-settings-toggle">
            <span>{t(language, 'Notification Sound', 'צליל התראה')}</span>
            <input
              type="checkbox"
              checked={mySettings?.notificationSound !== false}
              onChange={e => updateSettings && updateSettings({ notificationSound: e.target.checked })}
            />
            <span className="sc-toggle-slider" />
          </label>
          <label className="sc-settings-toggle">
            <span>{t(language, 'Desktop Notifications', 'התראות שולחן עבודה')}</span>
            <input
              type="checkbox"
              checked={mySettings?.desktopNotifications !== false}
              onChange={e => updateSettings && updateSettings({ desktopNotifications: e.target.checked })}
            />
            <span className="sc-toggle-slider" />
          </label>
        </div>

        {/* Backup */}
        <div className="sc-settings-section">
          <button className="sc-settings-backup-btn" onClick={downloadBackup}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t(language, 'Download Backup', 'הורד גיבוי')}
          </button>
        </div>
      </div>
    </div>
  );

  // ─── LEFT PANEL ───

  const renderLeftPanel = () => (
    <div className="sc-left-panel">
      {/* Header */}
      <div className="sc-left-header" onMouseDown={handleDragStart} style={{ cursor: 'grab' }}>
        <span className="sc-left-title">{t(language, 'Staff Chat', "צ'אט צוות")}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {/* Settings gear */}
          <button className="sc-header-icon-btn" onClick={() => setView('settings')} title={t(language, 'Settings', 'הגדרות')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button className="sc-close-btn" onClick={onClose} title={t(language, 'Close', 'סגור')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sc-tabs">
        <button
          className={`sc-tab ${leftTab === 'contacts' ? 'active' : ''}`}
          onClick={() => { setLeftTab('contacts'); setSearchTerm(''); }}
        >
          {t(language, 'Contacts', 'אנשי קשר')}
        </button>
        <button
          className={`sc-tab ${leftTab === 'chats' ? 'active' : ''}`}
          onClick={() => { setLeftTab('chats'); setSearchTerm(''); loadConversations(); }}
        >
          {t(language, 'Chats', "צ'אטים")}
          {totalUnreadCount > 0 && <span className="sc-tab-badge">{totalUnreadCount}</span>}
        </button>
        <button
          className={`sc-tab ${leftTab === 'new-group' ? 'active' : ''}`}
          onClick={() => { setLeftTab('new-group'); setSearchTerm(''); setSelectedUsers([]); setGroupName(''); }}
        >
          {t(language, 'Group+', 'קבוצה+')}
        </button>
      </div>

      {/* Search */}
      <div className="sc-search-bar">
        <input
          className="sc-search-input"
          placeholder={leftTab === 'chats'
            ? t(language, 'Search conversations...', 'חפש שיחות...')
            : t(language, 'Search contacts...', 'חפש אנשי קשר...')
          }
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Content based on tab */}
      <div className="sc-left-content">
        {leftTab === 'contacts' && renderContactsList()}
        {leftTab === 'chats' && renderChatsList()}
        {leftTab === 'new-group' && renderNewGroupTab()}
      </div>
    </div>
  );

  // ─── Contacts Tab ───

  const renderContactsList = () => (
    <div className="sc-contacts-list">
      {sortedUsers.length === 0 ? (
        <div className="sc-empty-state">
          <div className="sc-empty-text">{t(language, 'No contacts found', 'לא נמצאו אנשי קשר')}</div>
        </div>
      ) : (
        sortedUsers.map(u => {
          const isOnline = onlineUsers.has(u._id);
          const status = userStatuses[u._id];
          const availability = status?.availability || (isOnline ? 'online' : 'offline');
          const statusText = status?.statusText || '';

          return (
            <div
              key={u._id}
              className={`sc-contact-item ${activeConversation && activeConversation.participants?.some(p => p.userId === u._id) && activeConversation.type === 'direct' ? 'active' : ''}`}
              onClick={() => handleUserClick(u._id)}
            >
              <div className={`sc-avatar sc-avatar-${canonicalRole(u.role)}`}>
                {getProfileImage(u._id) ? (
                  <img src={getProfileImage(u._id)} alt="" className="sc-avatar-img" />
                ) : getInitials(u.displayName)}
                <div className="sc-online-dot" style={{ background: isOnline ? getAvailabilityColor(availability) : '#6b7280' }} />
              </div>
              <div className="sc-contact-info">
                <span className="sc-contact-name">{u.displayName}</span>
                {statusText ? (
                  <span className="sc-contact-status-text">{statusText}</span>
                ) : (
                  <span className={`sc-contact-status ${isOnline ? 'online' : ''}`}>
                    {isOnline ? getAvailabilityLabel(availability, language) : t(language, 'Offline', 'לא מחובר')}
                  </span>
                )}
              </div>
              <span className={`sc-role-badge sc-role-badge-${canonicalRole(u.role)}`}>{roleLabel(u.role, language)}</span>
            </div>
          );
        })
      )}
    </div>
  );

  // ─── Chats Tab ───

  const renderChatsList = () => (
    <div className="sc-conversation-list">
      {sortedConversations.length === 0 ? (
        <div className="sc-empty-state">
          <div className="sc-empty-text">
            {t(language, 'No conversations yet', 'אין שיחות עדיין')}
          </div>
          <div className="sc-empty-hint">
            {t(language, 'Click a contact to start chatting', 'לחץ על איש קשר כדי להתחיל')}
          </div>
        </div>
      ) : (
        sortedConversations.map(conv => {
          const convName = getConvName(conv);
          const convRole = getConvRole(conv);
          const isOnline = getConvOnline(conv);
          const unread = conv.unreadCounts?.[userId] || 0;
          const preview = conv.lastMessage?.content || '';
          const previewText = typeof preview === 'string' ? preview : '';
          const isActive = String(activeConversation?._id) === String(conv._id);
          const isPinned = !!(conv.pinnedBy && conv.pinnedBy[userId]);
          const isMuted = !!(conv.mutedBy && conv.mutedBy[userId]);

          // Get other user's status for direct chats
          const otherId = getOtherUserId(conv);
          const otherStatus = otherId ? userStatuses[otherId] : null;
          const availability = otherStatus?.availability || (isOnline ? 'online' : 'offline');

          return (
            <div
              key={String(conv._id)}
              className={`sc-conv-item ${isActive ? 'active' : ''}`}
              onClick={() => openConversation(conv)}
              onContextMenu={(e) => handleConvContextMenu(e, conv)}
            >
              <div className={`sc-avatar sc-avatar-${convRole}`}>
                {conv.type === 'group' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ) : (() => {
                  const otherUid = getOtherUserId(conv);
                  const img = otherUid && getProfileImage(otherUid);
                  return img ? <img src={img} alt="" className="sc-avatar-img" /> : getInitials(convName);
                })()}
                {conv.type === 'direct' && (
                  <div className="sc-online-dot" style={{ background: isOnline ? getAvailabilityColor(availability) : '#6b7280' }} />
                )}
              </div>
              <div className="sc-conv-info">
                <div className="sc-conv-name-row">
                  <span className="sc-conv-name">
                    {isPinned && <span className="sc-pin-icon">📌</span>}
                    {isMuted && <span className="sc-mute-icon">🔕</span>}
                    {convName}
                  </span>
                  <span className="sc-conv-time">{timeAgo(conv.lastMessage?.createdAt, language)}</span>
                </div>
                <div className="sc-conv-preview-row">
                  <span className="sc-conv-preview">
                    {conv.lastMessage?.senderId === userId && (
                      <Checkmarks message={conv.lastMessage} userId={userId} participantCount={conv.participants?.length || 2} />
                    )}
                    {conv.lastMessage?.senderId && conv.type === 'group' && conv.lastMessage.senderId !== userId
                      ? `${conv.lastMessage.senderName}: ${previewText}`
                      : previewText
                    }
                  </span>
                  {unread > 0 && <span className="sc-unread-badge">{unread}</span>}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Conversation context menu */}
      {showConvContextMenu && (
        <div
          className="sc-context-menu"
          style={{ top: showConvContextMenu.y, left: showConvContextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => { pinConversation && pinConversation(String(showConvContextMenu.conv._id)); setShowConvContextMenu(null); }}>
            {showConvContextMenu.conv.pinnedBy?.[userId]
              ? t(language, 'Unpin', 'בטל נעיצה')
              : t(language, 'Pin', 'נעץ')
            }
          </button>
          <button onClick={() => {
            const isMuted = !!(showConvContextMenu.conv.mutedBy?.[userId]);
            if (isMuted) {
              muteConversation && muteConversation(String(showConvContextMenu.conv._id), 'unmute');
            } else {
              muteConversation && muteConversation(String(showConvContextMenu.conv._id), 'always');
            }
            setShowConvContextMenu(null);
          }}>
            {showConvContextMenu.conv.mutedBy?.[userId]
              ? t(language, 'Unmute', 'בטל השתקה')
              : t(language, 'Mute', 'השתק')
            }
          </button>
        </div>
      )}
    </div>
  );

  // ─── New Group Tab ───

  const renderNewGroupTab = () => (
    <div className="sc-new-group-tab">
      <div className="sc-group-name-bar">
        <input
          className="sc-group-name-input"
          placeholder={t(language, 'Group name...', 'שם הקבוצה...')}
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
        />
        <button
          className="sc-create-btn"
          onClick={handleCreateGroup}
          disabled={!groupName.trim() || selectedUsers.length === 0}
        >
          {t(language, 'Create', 'צור')} {selectedUsers.length > 0 && `(${selectedUsers.length})`}
        </button>
      </div>
      <div className="sc-user-list">
        {groupedUsers.map(group => (
          <div key={group.title} className="sc-role-group">
            <div className="sc-role-group-title">{group.title}</div>
            {group.users.map(u => (
              <div
                key={u._id}
                className={`sc-user-item ${selectedUsers.includes(u._id) ? 'selected' : ''}`}
                onClick={() => toggleUserSelect(u._id)}
              >
                <input
                  type="checkbox"
                  className="sc-user-checkbox"
                  checked={selectedUsers.includes(u._id)}
                  onChange={() => toggleUserSelect(u._id)}
                  onClick={e => e.stopPropagation()}
                />
                <div className={`sc-avatar sc-avatar-${canonicalRole(u.role)}`} style={{ width: 32, height: 32, fontSize: 12 }}>
                  {getProfileImage(u._id) ? (
                    <img src={getProfileImage(u._id)} alt="" className="sc-avatar-img" />
                  ) : getInitials(u.displayName)}
                  <div className={`sc-online-dot ${onlineUsers.has(u._id) ? '' : 'offline'}`} />
                </div>
                <div className="sc-user-info">
                  <span className="sc-user-name">{u.displayName}</span>
                  <span className={`sc-role-badge sc-role-badge-${canonicalRole(u.role)}`}>{roleLabel(u.role, language)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  // ─── RIGHT PANEL (Chat Area) ───

  const renderRightPanel = () => {
    // Settings view
    if (view === 'settings') {
      return renderSettingsView();
    }

    if (!activeConversation) {
      return (
        <div className="sc-right-panel sc-right-empty">
          <div className="sc-welcome-icon">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#4dabf7" strokeWidth="1.5">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <div className="sc-welcome-title">{t(language, 'Staff Chat', "צ'אט צוות")}</div>
          <div className="sc-welcome-subtitle">
            {t(language, 'Select a contact to start a conversation', 'בחר איש קשר כדי להתחיל שיחה')}
          </div>
          <div className="sc-welcome-hint">
            {t(language, 'All messages are encrypted end-to-end', 'כל ההודעות מוצפנות מקצה לקצה')}
          </div>
        </div>
      );
    }

    const convName = getConvName(activeConversation);
    const convRole = getConvRole(activeConversation);
    const isGroup = activeConversation.type === 'group';
    const isOnline = getConvOnline(activeConversation);
    const otherId = getOtherUserId(activeConversation);
    const otherStatus = otherId ? userStatuses[otherId] : null;

    // Build header status text
    let headerStatus = '';
    if (isGroup) {
      headerStatus = t(language, `${activeConversation.participants?.length} members`, `${activeConversation.participants?.length} חברים`);
    } else if (isOnline) {
      const availability = otherStatus?.availability || 'online';
      headerStatus = otherStatus?.statusText || getAvailabilityLabel(availability, language);
    } else {
      headerStatus = formatLastSeen(otherStatus?.lastSeen, language);
    }

    if (showGroupInfo && isGroup) {
      return (
        <div className="sc-right-panel">
          <div className="sc-chat-header">
            <button className="sc-back-btn" onClick={() => setShowGroupInfo(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="sc-chat-header-title">{t(language, 'Group Info', 'פרטי קבוצה')}</span>
          </div>
          <Suspense fallback={<div style={{ padding: 20, color: '#9ca3af' }}>Loading...</div>}>
            <GroupInfoPanel
              conversation={activeConversation}
              userId={userId}
              language={language}
              onlineUsers={onlineUsers}
              practiceUsers={practiceUsers}
              onUpdateGroup={updateGroup}
              onBack={() => { setShowGroupInfo(false); closeConversation(); }}
            />
          </Suspense>
        </div>
      );
    }

    return (
      <div className="sc-right-panel">
        {/* Chat Header */}
        <div className="sc-chat-header" onMouseDown={handleDragStart} style={{ cursor: 'grab' }}>
          <div className={`sc-avatar sc-avatar-${convRole}`} style={{ width: 36, height: 36, fontSize: 13 }}>
            {isGroup ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            ) : (() => {
              const otherUid = getOtherUserId(activeConversation);
              const img = otherUid && getProfileImage(otherUid);
              return img ? <img src={img} alt="" className="sc-avatar-img" /> : getInitials(convName);
            })()}
          </div>
          <div
            className="sc-chat-header-info"
            onClick={() => isGroup && (loadPracticeUsers(), setShowGroupInfo(true))}
            style={{ cursor: isGroup ? 'pointer' : 'default' }}
          >
            <div className="sc-chat-header-title">{convName}</div>
            <div className="sc-chat-header-status">{headerStatus}</div>
          </div>
          {/* Search icon in header */}
          <button
            className="sc-header-icon-btn"
            onClick={() => { setShowChatSearch(!showChatSearch); setChatSearchTerm(''); setChatSearchResults(null); }}
            title={t(language, 'Search', 'חפש')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>

        {/* Chat search bar */}
        {showChatSearch && (
          <div className="sc-chat-search-bar">
            <input
              className="sc-chat-search-input"
              placeholder={t(language, 'Search in conversation...', 'חפש בשיחה...')}
              value={chatSearchTerm}
              onChange={e => setChatSearchTerm(e.target.value)}
              autoFocus
            />
            <button className="sc-close-btn" onClick={() => { setShowChatSearch(false); setChatSearchTerm(''); setChatSearchResults(null); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {chatSearchResults && (
              <div className="sc-chat-search-count">
                {chatSearchResults.length} {t(language, 'results', 'תוצאות')}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="sc-chat-area">
          {currentMessages.map((msg, idx) => {
            const isSent = msg.senderId === userId;
            const isSystem = msg.messageType === 'system';
            const isDeleted = msg.deletedForEveryone;
            const showDate = shouldShowDate(msg.createdAt, currentMessages[idx - 1]?.createdAt);
            const showSender = isGroup && !isSent && !isSystem &&
              (idx === 0 || currentMessages[idx - 1]?.senderId !== msg.senderId);
            const msgId = String(msg._id);
            const isHovered = hoveredMsgId === msgId;
            const reactions = msg.reactions || {};
            const reactionEntries = Object.entries(reactions).filter(([, users]) => users && users.length > 0);
            const canDeleteForEveryone = isSent && !isDeleted &&
              (Date.now() - new Date(msg.createdAt).getTime() < 15 * 60 * 1000);

            // Highlight search match
            const isSearchMatch = chatSearchResults?.some(r => String(r._id) === msgId);

            return (
              <React.Fragment key={msgId || idx}>
                {showDate && (
                  <div className="sc-date-separator">
                    <span>{formatDate(msg.createdAt, language)}</span>
                  </div>
                )}
                <div
                  className={`sc-message ${isSystem ? 'system' : isSent ? 'sent' : 'received'} ${isSearchMatch ? 'search-match' : ''}`}
                  onMouseEnter={() => !isSystem && !isDeleted && setHoveredMsgId(msgId)}
                  onMouseLeave={() => setHoveredMsgId(null)}
                  onContextMenu={(e) => !isSystem && !isDeleted && handleMessageContextMenu(e, msg)}
                >
                  {/* Forwarded label */}
                  {msg.forwardedFrom?.originalSenderName && (
                    <div className="sc-forwarded-label">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 17 20 12 15 7" /><path d="M4 12h16" />
                      </svg>
                      {t(language, 'Forwarded', 'הועבר')}
                    </div>
                  )}

                  {showSender && (
                    <span className={`sc-sender-name sc-sender-${activeConversation.participants?.find(p => p.userId === msg.senderId)?.role || 'staff'}`}>
                      {msg.senderName}
                    </span>
                  )}

                  {/* Reply preview */}
                  {msg.replyTo && (
                    <div className="sc-reply-preview">
                      <div className="sc-reply-preview-name">{msg.replyTo.senderName}</div>
                      <div className="sc-reply-preview-text">
                        {typeof msg.replyTo.content === 'string'
                          ? msg.replyTo.content.substring(0, 100)
                          : t(language, 'Message', 'הודעה')
                        }
                      </div>
                    </div>
                  )}

                  {/* Bubble */}
                  <div className="sc-bubble">
                    {isDeleted ? (
                      <span className="sc-deleted-text">{t(language, 'This message was deleted', 'הודעה זו נמחקה')}</span>
                    ) : (
                      formatMessageText(msg.content)
                    )}
                  </div>

                  {/* Quick react bar on hover */}
                  {isHovered && !isDeleted && (
                    <div className={`sc-quick-react ${isSent ? 'sent' : 'received'}`}>
                      {QUICK_REACTIONS.map(emoji => (
                        <button key={emoji} className="sc-quick-react-btn" onClick={() => handleReact(msg, emoji)}>
                          {emoji}
                        </button>
                      ))}
                      <button className="sc-quick-react-btn sc-more-btn" onClick={(e) => handleMessageContextMenu(e, msg)}>
                        ⋯
                      </button>
                    </div>
                  )}

                  {/* Reaction chips */}
                  {reactionEntries.length > 0 && (
                    <div className="sc-reaction-chips">
                      {reactionEntries.map(([emoji, users]) => (
                        <button
                          key={emoji}
                          className={`sc-reaction-chip ${users.includes(userId) ? 'mine' : ''}`}
                          onClick={() => handleReact(msg, emoji)}
                        >
                          {emoji} {users.length}
                        </button>
                      ))}
                    </div>
                  )}

                  {!isSystem && !isDeleted && (
                    <div className="sc-message-meta">
                      <span className="sc-message-time">{formatMessageTime(msg.createdAt)}</span>
                      {isSent && <Checkmarks message={msg} userId={userId} participantCount={participantCount} />}
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Message context menu */}
        {contextMenu && (
          <div
            className="sc-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => handleReply(contextMenu.message)}>
              {t(language, 'Reply', 'הגב')}
            </button>
            <button onClick={() => handleForward(contextMenu.message)}>
              {t(language, 'Forward', 'העבר')}
            </button>
            <button onClick={() => handleDeleteForMe(contextMenu.message)}>
              {t(language, 'Delete for me', 'מחק עבורי')}
            </button>
            {contextMenu.message.senderId === userId &&
              (Date.now() - new Date(contextMenu.message.createdAt).getTime() < 15 * 60 * 1000) && (
              <button className="sc-ctx-danger" onClick={() => handleDeleteForEveryone(contextMenu.message)}>
                {t(language, 'Delete for everyone', 'מחק עבור כולם')}
              </button>
            )}
          </div>
        )}

        {/* Typing Indicator */}
        {typingNames.length > 0 && (
          <div className="sc-typing-indicator">
            {typingNames.length === 1
              ? `${typingNames[0]} ${t(language, 'is typing', 'מקליד')}`
              : `${typingNames.length} ${t(language, 'people typing', 'אנשים מקלידים')}`
            }
            <span className="sc-typing-dots"><span /><span /><span /></span>
          </div>
        )}

        {/* Reply bar */}
        {replyingTo && (
          <div className="sc-reply-bar">
            <div className="sc-reply-bar-content">
              <div className="sc-reply-bar-name">{replyingTo.senderName}</div>
              <div className="sc-reply-bar-text">
                {typeof replyingTo.content === 'string'
                  ? replyingTo.content.substring(0, 80)
                  : t(language, 'Message', 'הודעה')
                }
              </div>
            </div>
            <button className="sc-close-btn" onClick={() => setReplyingTo && setReplyingTo(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="sc-input-bar">
          {/* Emoji picker button */}
          <button
            className="sc-emoji-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>

          {/* Emoji picker popover */}
          {showEmojiPicker && (
            <div className="sc-emoji-picker-wrapper">
              <EmojiPicker
                language={language}
                onSelect={(emoji) => setInputText(prev => prev + emoji)}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>
          )}

          <textarea
            ref={inputRef}
            className="sc-input-field"
            placeholder={t(language, 'Type a message...', 'הקלד הודעה...')}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="sc-send-btn" onClick={handleSendMessage} disabled={!inputText.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {/* Forward picker overlay */}
        {showForwardPicker && forwardingMessage && (
          <div className="sc-forward-overlay" onClick={() => { setShowForwardPicker(false); setForwardingMessage && setForwardingMessage(null); }}>
            <div className="sc-forward-picker" onClick={e => e.stopPropagation()}>
              <div className="sc-forward-header">
                <span>{t(language, 'Forward to...', 'העבר אל...')}</span>
                <button className="sc-close-btn" onClick={() => { setShowForwardPicker(false); setForwardingMessage && setForwardingMessage(null); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="sc-forward-list">
                {conversations.map(conv => (
                  <div
                    key={String(conv._id)}
                    className="sc-forward-item"
                    onClick={() => handleForwardTo(conv)}
                  >
                    <div className={`sc-avatar sc-avatar-${getConvRole(conv)}`} style={{ width: 32, height: 32, fontSize: 11 }}>
                      {conv.type === 'group' ? '👥' : (() => {
                        const otherUid = getOtherUserId(conv);
                        const img = otherUid && getProfileImage(otherUid);
                        return img ? <img src={img} alt="" className="sc-avatar-img" /> : getInitials(getConvName(conv));
                      })()}
                    </div>
                    <span>{getConvName(conv)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Render ───

  return (
    <div className="sc-floating-panel" dir={dir} ref={panelRef}>
      {renderLeftPanel()}
      {renderRightPanel()}
    </div>
  );
}
