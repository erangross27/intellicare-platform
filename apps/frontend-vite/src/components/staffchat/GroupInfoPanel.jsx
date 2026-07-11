import React, { useState, useMemo } from 'react';
import { roleLabel, canonicalRole } from '../../config/roleConfig';

const t = (lang, en, he) => lang === 'he' ? he : en;

export default function GroupInfoPanel({
  conversation,
  userId,
  language,
  onlineUsers,
  practiceUsers,
  onUpdateGroup,
  onBack
}) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState(conversation?.name || '');

  const isAdmin = conversation?.groupAdmin === userId;
  const participants = conversation?.participants || [];

  // Users not already in the group
  const availableUsers = useMemo(() => {
    const participantIds = new Set(participants.map(p => p.userId));
    return practiceUsers.filter(u => !participantIds.has(u._id));
  }, [practiceUsers, participants]);

  const filteredAvailable = useMemo(() => {
    if (!searchTerm.trim()) return availableUsers;
    const term = searchTerm.toLowerCase();
    return availableUsers.filter(u =>
      u.displayName.toLowerCase().includes(term)
    );
  }, [availableUsers, searchTerm]);

  const handleSaveName = async () => {
    if (groupName.trim() && groupName !== conversation?.name) {
      await onUpdateGroup(String(conversation._id), { name: groupName.trim() });
    }
    setEditingName(false);
  };

  const handleAddMember = async (memberId) => {
    await onUpdateGroup(String(conversation._id), { addParticipantIds: [memberId] });
    setShowAddMember(false);
    setSearchTerm('');
  };

  const handleRemoveMember = async (memberId) => {
    await onUpdateGroup(String(conversation._id), { removeParticipantIds: [memberId] });
  };

  const handleLeaveGroup = async () => {
    await onUpdateGroup(String(conversation._id), { removeParticipantIds: [userId] });
    onBack();
  };

  const getInitials = (name) => {
    const parts = name.split(' ').filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (name[0] || '?').toUpperCase();
  };

  return (
    <div className="sc-group-info">
      {/* Group Name */}
      <div style={{ marginBottom: 16 }}>
        {editingName && isAdmin ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="sc-group-name-input"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
            <button className="sc-create-btn" onClick={handleSaveName} style={{ padding: '6px 12px' }}>
              {t(language, 'Save', 'שמור')}
            </button>
          </div>
        ) : (
          <div
            className="sc-group-info-name"
            onClick={() => isAdmin && setEditingName(true)}
            style={{ cursor: isAdmin ? 'pointer' : 'default' }}
            title={isAdmin ? t(language, 'Click to edit', 'לחץ לעריכה') : ''}
          >
            {conversation?.name || 'Group'}
          </div>
        )}
        <div className="sc-group-info-meta">
          {t(language, `${participants.length} members`, `${participants.length} חברים`)}
        </div>
      </div>

      {/* Members */}
      <div className="sc-group-info-section">
        <div className="sc-group-info-section-title">
          {t(language, 'Members', 'חברים')}
        </div>
        {participants.map(p => (
          <div key={p.userId} className="sc-group-member">
            <div className={`sc-avatar sc-avatar-${canonicalRole(p.role)}`} style={{ width: 32, height: 32, fontSize: 12 }}>
              {getInitials(p.displayName)}
              <div className={`sc-online-dot ${onlineUsers.has(p.userId) ? '' : 'offline'}`}
                style={{ width: 8, height: 8 }} />
            </div>
            <div className="sc-member-info">
              <div className="sc-member-name">
                {p.displayName}
                {p.userId === conversation?.groupAdmin && (
                  <span className="sc-admin-badge" style={{ marginLeft: 6 }}>
                    {t(language, 'Admin', 'מנהל')}
                  </span>
                )}
              </div>
              <div className="sc-member-role">{roleLabel(p.role, language)}</div>
            </div>
            {isAdmin && p.userId !== userId && (
              <button
                className="sc-remove-member-btn"
                onClick={() => handleRemoveMember(p.userId)}
              >
                {t(language, 'Remove', 'הסר')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Member */}
      {isAdmin && (
        <div className="sc-group-info-section">
          {showAddMember ? (
            <>
              <input
                className="sc-search-input"
                placeholder={t(language, 'Search users...', 'חפש משתמשים...')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              {filteredAvailable.map(u => (
                <div key={u._id} className="sc-user-item" onClick={() => handleAddMember(u._id)}>
                  <div className={`sc-avatar sc-avatar-${canonicalRole(u.role)}`} style={{ width: 32, height: 32, fontSize: 12 }}>
                    {getInitials(u.displayName)}
                  </div>
                  <div className="sc-user-info">
                    <span className="sc-user-name">{u.displayName}</span>
                    <span className={`sc-role-badge sc-role-badge-${canonicalRole(u.role)}`}>{roleLabel(u.role, language)}</span>
                  </div>
                </div>
              ))}
              {filteredAvailable.length === 0 && (
                <div style={{ padding: '12px 0', color: '#6b7280', fontSize: 13, textAlign: 'center' }}>
                  {t(language, 'No users to add', 'אין משתמשים להוסיף')}
                </div>
              )}
            </>
          ) : (
            <button className="sc-header-btn" onClick={() => setShowAddMember(true)} style={{ width: '100%', justifyContent: 'center' }}>
              + {t(language, 'Add Member', 'הוסף חבר')}
            </button>
          )}
        </div>
      )}

      {/* Leave Group */}
      <button className="sc-leave-group-btn" onClick={handleLeaveGroup}>
        {t(language, 'Leave Group', 'עזוב קבוצה')}
      </button>
    </div>
  );
}
