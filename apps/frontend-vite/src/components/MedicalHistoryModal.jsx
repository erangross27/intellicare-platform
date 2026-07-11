import React, { useState, useMemo } from 'react';
import { useLanguage } from '../config/languagesStatic';
import secureApi from '../services/secureApiClient';

const MedicalHistoryModal = ({
  entry,
  category,
  entries = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
  patientId
}) => {
  const { t, isRTL } = useLanguage();

  // Format medical text into readable sections
  const formatMedicalText = (text) => {
    if (!text || typeof text !== 'string') return null;

    // Split by common medical separators and clean up
    const sections = text
      .split(/[.;]\s+/)
      .map(section => section.trim())
      .filter(section => section.length > 3)
      .slice(0, 5); // Limit to 5 key points

    if (sections.length === 0) return null;

    return (
      <div style={{...styles.formattedText, direction: isRTL ? 'rtl' : 'ltr'}}>
        {sections.map((section, index) => (
          <div key={index} style={{...styles.textSection, textAlign: isRTL ? 'right' : 'left'}}>
            <span style={styles.bulletPoint}>•</span>
            <span style={styles.sectionText}>{section}</span>
          </div>
        ))}
      </div>
    );
  };

  // Smart date formatting - show time only if meaningful (not timezone artifacts)
  const formatSmartDate = (date) => {
    const dateObj = new Date(date);
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();

    // Consider it date-only if it's a timezone artifact:
    // 1. Exactly midnight (00:00)
    // 2. Exactly 3:00 (UTC+3 timezone offset for date-only values)
    // 3. Any hour with 0 minutes that's likely a timezone offset (0-12)
    const isDateOnly = (hours === 0 && minutes === 0) ||
                       (hours === 3 && minutes === 0) ||
                       (hours <= 12 && minutes === 0);

    const hasTime = !isDateOnly;

    if (hasTime) {
      // Show date with time
      return dateObj.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // Show date only (no time)
      return dateObj.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const [mode, setMode] = useState('view'); // 'view', 'edit', 'list'
  const [selectedEntry, setSelectedEntry] = useState(entry || null);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'timeline'
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Custom date picker functions
  const formatDateForDisplay = (date) => {
    return date.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateForInput = (date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setFormData(prev => ({
      ...prev,
      date: formatDateForInput(date)
    }));
    setShowDatePicker(false);
  };

  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const today = new Date();

    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = currentDate.toDateString() === today.toDateString();
      const isSelected = currentDate.toDateString() === selectedDate.toDateString();

      days.push({
        date: currentDate,
        day: currentDate.getDate(),
        isCurrentMonth,
        isToday,
        isSelected
      });
    }

    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setSelectedDate(newDate);
  };

  const renderCalendarModal = () => {
    if (!showDatePicker) return null;

    const days = generateCalendarDays();
    const monthYear = selectedDate.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'long'
    });

    return (
      <div style={styles.calendarModal} onClick={() => setShowDatePicker(false)}>
        <div style={styles.calendarContainer} onClick={(e) => e.stopPropagation()}>
          <div style={styles.calendarHeader}>
            <button
              style={styles.calendarNav}
              onClick={() => navigateMonth(-1)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f7fafc'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ⬅
            </button>
            <h3 style={styles.calendarTitle}>{monthYear}</h3>
            <button
              style={styles.calendarNav}
              onClick={() => navigateMonth(1)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f7fafc'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ➡
            </button>
          </div>

          {/* Day headers */}
          <div style={styles.calendarGrid}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={styles.calendarDayHeader}>
                {t(day.toLowerCase())}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div style={styles.calendarGrid}>
            {days.map((dayObj, index) => (
              <div
                key={index}
                style={{
                  ...styles.calendarDay,
                  ...(dayObj.isSelected ? styles.calendarDaySelected : {}),
                  ...(dayObj.isToday && !dayObj.isSelected ? styles.calendarDayToday : {}),
                  opacity: dayObj.isCurrentMonth ? 1 : 0.3
                }}
                onClick={() => handleDateSelect(dayObj.date)}
                onMouseEnter={(e) => {
                  if (!dayObj.isSelected) {
                    e.target.style.backgroundColor = '#f7fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!dayObj.isSelected) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {dayObj.day}
              </div>
            ))}
          </div>

          <div style={styles.calendarButtons}>
            <button
              style={{...styles.button, ...styles.cancelButton}}
              onClick={() => setShowDatePicker(false)}
            >
              {t('cancel')}
            </button>
            <button
              style={{...styles.button, ...styles.saveButton}}
              onClick={() => handleDateSelect(selectedDate)}
            >
              {t('select')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Reset selectedEntry when modal opens with different category/entries
  React.useEffect(() => {
    if (isOpen) {
      if (entry) {
        setSelectedEntry(entry);
      } else if (entries.length > 0) {
        setSelectedEntry(entries[0]);
      } else {
        setSelectedEntry(null); // Clear when no entries
      }
      setMode('view');
    }
  }, [isOpen, entry, entries]);
  const [formData, setFormData] = useState({
    date: entry?.date ? new Date(entry.date).toISOString().split('T')[0] : '',
    diagnosis: entry?.diagnosis || '',
    symptoms: entry?.symptoms || '',
    treatment: entry?.treatment || '',
    notes: entry?.notes || ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await secureApi.put(`/patients/${patientId}/history/${selectedEntry._id}`, formData);

      if (result.success) {
        onSave(result.data);
        setMode('view');
        setSelectedEntry(result.data);
      } else {
        setError(result.error || t('errorUpdatingEntry'));
      }
    } catch (err) {
      setError(t('errorUpdatingEntry'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('confirmDeleteEntry'))) return;

    setIsLoading(true);
    try {
      const result = await secureApi.delete(`/patients/${patientId}/history/${selectedEntry._id}`, {
        deletedBy: 'doctor' // Could be dynamic based on user role
      });
      if (result.success) {
        onDelete(selectedEntry._id);
        onClose();
      } else {
        setError(result.error || t('errorDeletingEntry'));
      }
    } catch (err) {
      setError(t('errorDeletingEntry'));
    } finally {
      setIsLoading(false);
    }
  };



  const handleEntrySelect = (entryItem) => {
    setSelectedEntry(entryItem);
    setFormData({
      date: entryItem?.date ? new Date(entryItem.date).toISOString().split('T')[0] : '',
      diagnosis: entryItem?.diagnosis || '',
      symptoms: entryItem?.symptoms || '',
      treatment: entryItem?.treatment || '',
      notes: entryItem?.notes || ''
    });
    setMode('view');
  };

  const styles = useMemo(() => ({
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    },
    modal: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      padding: '0',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
      direction: isRTL ? 'rtl' : 'ltr',
      overflow: 'hidden'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '24px 24px 16px 24px',
      borderBottom: '1px solid #e2e8f0',
      flexShrink: 0
    },
    content: {
      flex: 1,
      overflowY: 'hidden',
      padding: '0',
      display: 'flex',
      flexDirection: 'column'
    },
    tabContainer: {
      display: 'flex',
      borderBottom: '2px solid #e2e8f0',
      backgroundColor: '#f8fafc',
      padding: '0 24px'
    },
    tab: {
      padding: '12px 20px',
      cursor: 'pointer',
      borderBottom: '2px solid transparent',
      fontSize: '14px',
      fontWeight: '500',
      color: '#64748b',
      transition: 'all 0.2s ease',
      marginBottom: '-2px'
    },
    activeTab: {
      color: '#667eea',
      borderBottom: '2px solid #667eea', // Use full borderBottom instead of borderBottomColor
      backgroundColor: 'white'
    },
    tabContent: {
      padding: '24px',
      flex: 1,
      overflowY: 'auto',
      scrollbarWidth: 'thin',
      scrollbarColor: '#667eea #f1f1f1'
    },
    overviewGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '20px'
    },
    overviewCard: {
      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.03) 100%)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e2e8f0'
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#2d3748',
      marginBottom: '12px',
      borderBottom: '2px solid #667eea',
      paddingBottom: '8px'
    },
    cardContent: {
      fontSize: '14px',
      color: '#4a5568',
      lineHeight: '1.6',
      margin: 0
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px'
    },
    infoLabel: {
      fontSize: '14px',
      color: '#718096',
      fontWeight: '500'
    },
    infoValue: {
      fontSize: '14px',
      color: '#2d3748',
      fontWeight: '600'
    },

    formattedText: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    textSection: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px'
    },
    bulletPoint: {
      color: '#667eea',
      fontWeight: 'bold',
      fontSize: '16px',
      marginTop: '2px'
    },
    sectionText: {
      fontSize: '14px',
      color: '#4a5568',
      lineHeight: '1.6',
      flex: 1
    },
    timelineContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#2d3748',
      marginBottom: '16px'
    },
    timelineItem: {
      display: 'flex',
      gap: '16px',
      padding: '16px',
      background: '#f8fafc',
      borderRadius: '8px',
      borderLeft: '4px solid #667eea'
    },
    timelineDate: {
      fontSize: '12px',
      color: '#718096',
      fontWeight: '500',
      minWidth: '100px'
    },
    timelineContent: {
      flex: 1
    },
    timelineTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#2d3748',
      margin: '0 0 4px 0'
    },
    timelineDescription: {
      fontSize: '14px',
      color: '#4a5568',
      margin: 0
    },

    deleteButton: {
      borderColor: '#fed7d7',
      color: '#e53e3e',
      background: '#fef5f5'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px'
    },
    cardActions: {
      display: 'flex',
      gap: '8px'
    },
    editButton: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: '1px solid #e2e8f0',
      background: 'white',
      color: '#4a5568',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    deleteButtonSmall: {
      padding: '6px 12px',
      borderRadius: '6px',
      border: '1px solid #fed7d7',
      background: '#fef5f5',
      color: '#e53e3e',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    editContainer: {
      padding: '20px',
      height: '100%',
      overflowY: 'auto'
    },
    editForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      height: '100%'
    },
    editGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      marginBottom: '20px'
    },
    editSection: {
      background: '#f8fafc',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid #e2e8f0'
    },
    editSectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#2d3748',
      marginBottom: '12px',
      borderBottom: '2px solid #667eea',
      paddingBottom: '6px'
    },
    editField: {
      marginBottom: '12px'
    },
    editLabel: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: '#4a5568',
      marginBottom: '6px',
      textAlign: isRTL ? 'right' : 'left'
    },
    editInput: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid #e2e8f0',
      fontSize: '14px',
      color: '#2d3748',
      background: 'white',
      transition: 'border-color 0.2s ease',
      textAlign: isRTL ? 'right' : 'left'
    },
    editTextarea: {
      width: '100%',
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid #e2e8f0',
      fontSize: '14px',
      color: '#2d3748',
      background: 'white',
      transition: 'border-color 0.2s ease',
      textAlign: isRTL ? 'right' : 'left',
      minHeight: '80px',
      resize: 'vertical',
      fontFamily: 'inherit'
    },
    datePickerContainer: {
      position: 'relative',
      width: '100%'
    },
    datePickerInput: {
      width: '100%',
      padding: '8px 40px 8px 12px',
      borderRadius: '6px',
      border: '1px solid #e2e8f0',
      fontSize: '14px',
      color: '#2d3748',
      background: 'white',
      transition: 'border-color 0.2s ease',
      textAlign: isRTL ? 'right' : 'left',
      cursor: 'pointer'
    },
    datePickerIcon: {
      position: 'absolute',
      right: isRTL ? 'auto' : '12px',
      left: isRTL ? '12px' : 'auto',
      top: '50%',
      transform: 'translateY(-50%)',
      fontSize: '18px',
      color: '#667eea',
      cursor: 'pointer',
      padding: '4px'
    },
    calendarModal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    },
    calendarContainer: {
      backgroundColor: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      maxWidth: '400px',
      width: '90%'
    },
    calendarHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px'
    },
    calendarTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#2d3748'
    },
    calendarNav: {
      background: 'none',
      border: 'none',
      fontSize: '20px',
      color: '#667eea',
      cursor: 'pointer',
      padding: '8px',
      borderRadius: '6px',
      transition: 'background-color 0.2s ease'
    },
    calendarGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '4px',
      marginBottom: '20px'
    },
    calendarDay: {
      padding: '12px',
      textAlign: 'center',
      fontSize: '14px',
      color: '#4a5568',
      cursor: 'pointer',
      borderRadius: '6px',
      transition: 'all 0.2s ease'
    },
    calendarDayHeader: {
      padding: '8px',
      textAlign: 'center',
      fontSize: '12px',
      fontWeight: '600',
      color: '#718096'
    },
    calendarDaySelected: {
      backgroundColor: '#667eea',
      color: 'white'
    },
    calendarDayToday: {
      backgroundColor: '#e2e8f0',
      color: '#2d3748'
    },
    calendarButtons: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end'
    },
    title: {
      fontSize: '24px',
      fontWeight: '600',
      color: '#2d3748',
      margin: 0
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#718096',
      padding: '4px',
      borderRadius: '8px',
      transition: 'all 0.2s ease'
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    label: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#4a5568',
      textAlign: isRTL ? 'right' : 'left'
    },
    input: {
      padding: '12px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '16px',
      transition: 'border-color 0.2s ease',
      direction: isRTL ? 'rtl' : 'ltr',
      textAlign: isRTL ? 'right' : 'left'
    },
    textarea: {
      padding: '12px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '16px',
      minHeight: '100px',
      resize: 'vertical',
      fontFamily: 'inherit',
      transition: 'border-color 0.2s ease',
      direction: isRTL ? 'rtl' : 'ltr',
      textAlign: isRTL ? 'right' : 'left'
    },
    buttonGroup: {
      display: 'flex',
      gap: '12px',
      justifyContent: isRTL ? 'flex-start' : 'flex-end',
      padding: '16px 24px 24px 24px',
      borderTop: '1px solid #e2e8f0',
      flexShrink: 0,
      backgroundColor: '#ffffff'
    },
    button: {
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: 'none'
    },
    cancelButton: {
      backgroundColor: '#f7fafc',
      color: '#4a5568',
      border: '2px solid #e2e8f0'
    },
    saveButton: {
      backgroundColor: '#667eea',
      color: '#ffffff'
    },
    saveButtonDisabled: {
      backgroundColor: '#a0aec0',
      cursor: 'not-allowed'
    },
    error: {
      backgroundColor: '#fed7d7',
      color: '#c53030',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      textAlign: isRTL ? 'right' : 'left'
    },
    listHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #e2e8f0'
    },
    categoryTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#2d3748',
      margin: 0
    },
    entryCount: {
      fontSize: '14px',
      color: '#718096'
    },
    entriesList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    },
    entryItem: {
      display: 'flex',
      alignItems: 'center',
      padding: '12px 16px',
      backgroundColor: '#f7fafc',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    entryDate: {
      fontSize: '14px',
      color: '#718096',
      minWidth: '100px'
    },
    entryDiagnosis: {
      flex: 1,
      fontSize: '16px',
      color: '#2d3748',
      marginLeft: isRTL ? '0' : '12px',
      marginRight: isRTL ? '12px' : '0'
    },
    entryArrow: {
      fontSize: '16px',
      color: '#a0aec0'
    },
    viewHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '1px solid #e2e8f0'
    },
    viewDate: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#667eea'
    },
    viewActions: {
      display: 'flex',
      gap: '8px'
    },
    actionButton: {
      padding: '8px 16px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      border: 'none',
      backgroundColor: '#667eea',
      color: '#ffffff',
      transition: 'all 0.2s ease'
    },
    deleteButtonAction: {
      backgroundColor: '#e53e3e'
    },
    viewContent: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    viewField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },
    viewLabel: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#4a5568'
    },
    viewValue: {
      fontSize: '16px',
      color: '#2d3748',
      padding: '8px 12px',
      backgroundColor: '#f7fafc',
      borderRadius: '6px',
      minHeight: '20px'
    },
    structuredSection: {
      marginBottom: '24px',
      padding: '16px',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0'
    },
    structuredTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#667eea',
      margin: '0 0 12px 0',
      textAlign: isRTL ? 'right' : 'left'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#718096'
    },
    emptyMessage: {
      fontSize: '16px',
      margin: 0
    }
  }), [isRTL]);

  // Sort entries by date (newest first) for display
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0);
      const dateB = new Date(b.date || b.createdAt || 0);
      return dateB - dateA; // Descending order (newest first)
    });
  }, [entries]);

  const renderListView = () => (
    <div>
      <div style={styles.listHeader}>
        <h3 style={styles.categoryTitle}>{category}</h3>
        <span style={styles.entryCount}>{entries.length} {t('entries')}</span>
      </div>
      <div style={styles.entriesList}>
        {sortedEntries.map((entryItem, index) => (
          <div
            key={entryItem._id || index}
            style={styles.entryItem}
            onClick={() => handleEntrySelect(entryItem)}
          >
            <div style={styles.entryDate}>
              {formatSmartDate(entryItem.date)}
            </div>
            <div style={styles.entryDiagnosis}>{entryItem.diagnosis}</div>
            <div style={styles.entryArrow}>→</div>
          </div>
        ))}
      </div>
    </div>
  );





  // Tab content renderers
  const renderOverviewTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.overviewGrid}>
        <div style={styles.overviewCard}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>{t('basicInfo')}</h3>
            <div style={styles.cardActions}>
              <button style={styles.editButton} onClick={() => setMode('edit')}>
                📝 {t('edit')}
              </button>
              <button style={styles.deleteButtonSmall} onClick={() => handleDelete(selectedEntry)}>
                🗑️ {t('delete')}
              </button>
            </div>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t('date')}:</span>
            <span style={styles.infoValue}>{formatSmartDate(selectedEntry.date)}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>{t('category')}:</span>
            <span style={styles.infoValue}>{t(category)}</span>
          </div>
        </div>

        <div style={styles.overviewCard}>
          <h3 style={styles.cardTitle}>{t('diagnosis')}</h3>
          <div style={{...styles.cardContent, textAlign: isRTL ? 'right' : 'left'}}>
            {selectedEntry.diagnosis || t('notSpecified')}
          </div>
        </div>

        {selectedEntry.symptoms && (
          <div style={styles.overviewCard}>
            <h3 style={styles.cardTitle}>{t('symptoms')}</h3>
            <div style={{...styles.cardContent, textAlign: isRTL ? 'right' : 'left'}}>
              {formatMedicalText(selectedEntry.symptoms)}
            </div>
          </div>
        )}

        {selectedEntry.treatment && (
          <div style={styles.overviewCard}>
            <h3 style={styles.cardTitle}>{t('treatment')}</h3>
            <div style={{...styles.cardContent, textAlign: isRTL ? 'right' : 'left'}}>
              {formatMedicalText(selectedEntry.treatment)}
            </div>
          </div>
        )}
      </div>
    </div>
  );



  const renderTimelineTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.timelineContainer}>
        <h3 style={styles.sectionTitle}>{t('medicalTimeline')}</h3>
        <div style={styles.timelineItem}>
          <div style={styles.timelineDate}>{formatSmartDate(selectedEntry.date)}</div>
          <div style={styles.timelineContent}>
            <h4 style={styles.timelineTitle}>{selectedEntry.diagnosis}</h4>
            <p style={styles.timelineDescription}>{t('recordCreated')}</p>
          </div>
        </div>
      </div>
    </div>
  );


  if (!isOpen) return null;

  // Determine initial mode - commented out as not used
  // const initialMode = entry ? 'view' : (entries.length > 1 ? 'list' : 'view');
  if (mode === 'view' && !selectedEntry && entries.length > 0) {
    setSelectedEntry(entries[0]);
    setFormData({
      date: entries[0]?.date ? new Date(entries[0].date).toISOString().split('T')[0] : '',
      diagnosis: entries[0]?.diagnosis || '',
      symptoms: entries[0]?.symptoms || '',
      treatment: entries[0]?.treatment || '',
      notes: entries[0]?.notes || ''
    });
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>
            {mode === 'edit' ? t('editMedicalHistoryEntry') :
             mode === 'list' ? t('medicalHistoryEntries') :
             t('viewMedicalHistoryEntry')}
          </h2>
          <button
            style={styles.closeButton}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f7fafc';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        {mode === 'view' && selectedEntry && (
          <div style={styles.tabContainer}>
            {['details', 'timeline'].map(tab => (
              <div
                key={tab}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab ? styles.activeTab : {})
                }}
                onClick={() => setActiveTab(tab)}
              >
                {t(tab)}
              </div>
            ))}
          </div>
        )}

        <div style={styles.content}>
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {mode === 'list' && renderListView()}
          {mode === 'view' && selectedEntry && (
            <>
              {activeTab === 'details' && renderOverviewTab()}
              {activeTab === 'timeline' && renderTimelineTab()}
            </>
          )}
          {mode === 'view' && !selectedEntry && entries.length === 0 && (
            <div style={styles.emptyState}>
              <p style={styles.emptyMessage}>{t('noEntriesForCategory')}</p>
            </div>
          )}
          {mode === 'edit' && selectedEntry && (
            <div style={styles.editContainer}>
              <form style={styles.editForm} onSubmit={handleSubmit} autoComplete="off" aria-autocomplete="none">
                {/* Hidden dummy fields to deter browser autofill */}
                <input type="text" name="_fake_user" style={{ display: 'none' }} autoComplete="off" />
                <input type="password" name="_fake_pass" style={{ display: 'none' }} autoComplete="new-password" />
                <div style={styles.editGrid}>
                  {/* Basic Info Section */}
                  <div style={styles.editSection}>
                    <h3 style={styles.editSectionTitle}>{t('basicInfo')}</h3>
                    <div style={styles.editField}>
                      <label style={styles.editLabel}>{t('date')} *</label>
                      <div style={styles.datePickerContainer}>
                        <input
                          style={styles.datePickerInput}
                          type="text"
                          value={formData.date ? formatDateForDisplay(new Date(formData.date)) : ''}
                          placeholder={t('selectDate')}
                          readOnly
                          onClick={() => setShowDatePicker(true)}
                        />
                        <div
                          style={styles.datePickerIcon}
                          onClick={() => setShowDatePicker(true)}
                        >
                          📅
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Medical Info Section */}
                  <div style={styles.editSection}>
                    <h3 style={styles.editSectionTitle}>{t('medicalInformation')}</h3>
                    <div style={styles.editField}>
                      <label style={styles.editLabel}>{t('diagnosis')} *</label>
                      <input
                        style={styles.editInput}
                        type="text"
                        name="diagnosis"
                        value={formData.diagnosis}
                        onChange={handleInputChange}
                        placeholder={t('enterDiagnosis')}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Symptoms Section */}
                <div style={styles.editSection}>
                  <h3 style={styles.editSectionTitle}>{t('symptoms')}</h3>
                  <div style={styles.editField}>
                    <textarea
                      style={styles.editTextarea}
                      name="symptoms"
                      value={formData.symptoms}
                      onChange={handleInputChange}
                      placeholder={t('enterSymptoms')}
                    />
                  </div>
                </div>

                {/* Treatment Section */}
                <div style={styles.editSection}>
                  <h3 style={styles.editSectionTitle}>{t('treatment')}</h3>
                  <div style={styles.editField}>
                    <textarea
                      style={styles.editTextarea}
                      name="treatment"
                      value={formData.treatment}
                      onChange={handleInputChange}
                      placeholder={t('enterTreatment')}
                    />
                  </div>
                </div>

                {/* Notes Section */}
                <div style={styles.editSection}>
                  <h3 style={styles.editSectionTitle}>{t('notes')}</h3>
                  <div style={styles.editField}>
                    <textarea
                      style={styles.editTextarea}
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder={t('enterNotes')}
                    />
                  </div>
                </div>

                <div style={styles.buttonGroup}>
                  <button
                    type="button"
                    style={{...styles.button, ...styles.cancelButton}}
                    onClick={() => setMode('view')}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    style={{
                      ...styles.button,
                      ...styles.saveButton,
                      ...(isLoading ? styles.saveButtonDisabled : {})
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? t('saving') : t('save')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {(mode === 'view' || mode === 'list') && (
          <div style={styles.buttonGroup}>
            <button
              style={{...styles.button, ...styles.cancelButton}}
              onClick={onClose}
            >
              {t('close')}
            </button>
            {entries.length > 1 && mode === 'view' && (
              <button
                style={{...styles.button, ...styles.saveButton}}
                onClick={() => setMode('list')}
              >
                {t('viewAll')}
              </button>
            )}
          </div>
        )}
      </div>
      {renderCalendarModal()}
    </div>
  );
};

export default MedicalHistoryModal;
