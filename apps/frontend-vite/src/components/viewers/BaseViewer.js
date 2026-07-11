import React, { useState, useEffect } from 'react';

/**
 * Base Viewer Component
 * All medical viewers extend from this base class
 * Provides common functionality for display/edit/add modes
 */
const BaseViewer = ({ 
  data, 
  language, 
  mode = 'view',
  type,
  onUpdate,
  onClose 
}) => {
  const isRTL = language === 'he';
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  
  // Common styles for all viewers
  const baseStyles = {
    container: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      direction: isRTL ? 'rtl' : 'ltr',
      color: '#e8eaf0',
      overflowY: 'auto',
      background: 'transparent',
      fontFamily: "'Inter', 'SF Pro Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
      position: 'relative'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    title: {
      margin: 0,
      fontSize: '24px',
      fontWeight: 600,
      color: '#ffffff'
    },
    subtitle: {
      fontSize: '14px',
      color: '#a8b2d1',
      marginTop: '4px'
    },
    closeButton: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      borderRadius: '8px',
      padding: '8px 16px',
      color: '#4a9eff',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s ease',
      fontFamily: 'inherit'
    },
    section: {
      marginBottom: '24px'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 600,
      color: '#ffffff',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid rgba(74, 158, 255, 0.1)'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '16px'
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    },
    label: {
      fontSize: '13px',
      color: '#8b949e',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    value: {
      fontSize: '15px',
      color: '#e8eaf0',
      padding: '10px 14px',
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      border: '1px solid transparent',
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center'
    },
    input: {
      fontSize: '15px',
      color: '#e8eaf0',
      padding: '10px 14px',
      background: 'rgba(30, 41, 59, 0.7)',
      borderRadius: '8px',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      minHeight: '40px',
      outline: 'none',
      fontFamily: 'inherit',
      width: '100%',
      transition: 'all 0.2s ease'
    },
    textarea: {
      fontSize: '15px',
      color: '#e8eaf0',
      padding: '10px 14px',
      background: 'rgba(30, 41, 59, 0.7)',
      borderRadius: '8px',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      minHeight: '80px',
      outline: 'none',
      fontFamily: 'inherit',
      width: '100%',
      resize: 'vertical',
      transition: 'all 0.2s ease'
    },
    button: {
      background: 'linear-gradient(135deg, #4a9eff, #667eea)',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 20px',
      color: '#ffffff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      fontFamily: 'inherit'
    },
    successBox: {
      background: 'rgba(52, 211, 153, 0.1)',
      border: '1px solid rgba(52, 211, 153, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#34d399',
      marginBottom: '16px'
    },
    errorBox: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#ef4444',
      marginBottom: '16px'
    },
    warningBox: {
      background: 'rgba(251, 191, 36, 0.1)',
      border: '1px solid rgba(251, 191, 36, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#fbbf24',
      marginBottom: '16px'
    },
    infoBox: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.3)',
      borderRadius: '8px',
      padding: '16px',
      color: '#4a9eff',
      marginBottom: '16px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '48px 24px',
      color: '#8b949e'
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
      opacity: 0.5
    },
    emptyText: {
      fontSize: '16px',
      marginBottom: '8px'
    },
    emptyHint: {
      fontSize: '14px',
      color: '#667eea'
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    listItem: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid rgba(74, 158, 255, 0.1)',
      transition: 'all 0.2s ease'
    },
    listItemHover: {
      background: 'rgba(74, 158, 255, 0.1)',
      border: '1px solid rgba(74, 158, 255, 0.3)'
    },
    badge: {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 500,
      marginRight: '8px'
    },
    badgeSuccess: {
      background: 'rgba(52, 211, 153, 0.2)',
      color: '#34d399'
    },
    badgeWarning: {
      background: 'rgba(251, 191, 36, 0.2)',
      color: '#fbbf24'
    },
    badgeDanger: {
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444'
    },
    badgeInfo: {
      background: 'rgba(74, 158, 255, 0.2)',
      color: '#4a9eff'
    },
    card: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(74, 158, 255, 0.1)',
      marginBottom: '16px'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid rgba(74, 158, 255, 0.1)'
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: 600,
      color: '#ffffff'
    },
    cardContent: {
      fontSize: '14px',
      color: '#e8eaf0',
      lineHeight: '1.6'
    },
    timeline: {
      position: 'relative',
      paddingLeft: isRTL ? 0 : '32px',
      paddingRight: isRTL ? '32px' : 0
    },
    timelineItem: {
      position: 'relative',
      marginBottom: '24px'
    },
    timelineDot: {
      position: 'absolute',
      left: isRTL ? 'auto' : '-28px',
      right: isRTL ? '-28px' : 'auto',
      top: '6px',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: '#4a9eff',
      border: '2px solid #1e2341'
    },
    timelineLine: {
      position: 'absolute',
      left: isRTL ? 'auto' : '-22px',
      right: isRTL ? '-22px' : 'auto',
      top: '18px',
      bottom: '-24px',
      width: '1px',
      background: 'rgba(74, 158, 255, 0.2)'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    tableHeader: {
      background: 'rgba(30, 41, 59, 0.5)',
      borderBottom: '2px solid rgba(74, 158, 255, 0.2)'
    },
    tableHeaderCell: {
      padding: '12px',
      textAlign: isRTL ? 'right' : 'left',
      fontSize: '13px',
      fontWeight: 600,
      color: '#a8b2d1',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    tableRow: {
      borderBottom: '1px solid rgba(74, 158, 255, 0.1)',
      transition: 'all 0.2s ease'
    },
    tableRowHover: {
      background: 'rgba(74, 158, 255, 0.05)'
    },
    tableCell: {
      padding: '12px',
      fontSize: '14px',
      color: '#e8eaf0'
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px',
      borderBottom: '1px solid rgba(74, 158, 255, 0.2)',
      paddingBottom: '0'
    },
    tab: {
      padding: '12px 20px',
      background: 'transparent',
      border: 'none',
      color: '#8b949e',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      borderBottom: '2px solid transparent',
      fontFamily: 'inherit'
    },
    tabActive: {
      color: '#4a9eff',
      borderBottom: '2px solid #4a9eff'
    },
    chip: {
      display: 'inline-block',
      padding: '6px 12px',
      borderRadius: '16px',
      fontSize: '13px',
      fontWeight: 500,
      background: 'rgba(74, 158, 255, 0.1)',
      color: '#4a9eff',
      margin: '4px'
    },
    progressBar: {
      height: '8px',
      background: 'rgba(30, 41, 59, 0.5)',
      borderRadius: '4px',
      overflow: 'hidden'
    },
    progressFill: {
      height: '100%',
      background: 'linear-gradient(90deg, #4a9eff, #667eea)',
      borderRadius: '4px',
      transition: 'width 0.3s ease'
    }
  };
  
  // Helper functions
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(isRTL ? 'he-IL' : 'en-US');
  };
  
  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString(isRTL ? 'he-IL' : 'en-US');
  };
  
  const formatCurrency = (amount) => {
    if (!amount) return '-';
    const currency = isRTL ? 'ILS' : 'USD';
    return new Intl.NumberFormat(isRTL ? 'he-IL' : 'en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };
  
  // Export everything for child components
  return {
    isRTL,
    isViewMode,
    isEditMode,
    isAddMode,
    baseStyles,
    formatDate,
    formatDateTime,
    formatCurrency
  };
};

export default BaseViewer;