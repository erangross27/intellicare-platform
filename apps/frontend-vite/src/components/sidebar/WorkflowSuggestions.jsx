import React, { useState, useEffect } from 'react';
import platformFunctionHelpService from '../../services/platformFunctionHelpServiceV2';

const WorkflowSuggestions = ({
  language = 'en',
  chatState = null,
  userProfile = null,
  onSendMessage = null
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const isRTL = language === 'he';

  // Add CSS to hide scrollbar for webkit browsers
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .workflow-suggestions-container::-webkit-scrollbar {
        display: none;
      }
      .workflow-suggestions-container {
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  // Proactive workflow suggestions based on time of day and context
  const getProactiveSuggestions = () => {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    const workflows = [];
    
    // Morning workflows (6 AM - 12 PM)
    if (hour >= 6 && hour < 12) {
      workflows.push({
        id: 'morning-review',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ),
        title: language === 'he' ? 'סקירת בוקר' : 'Morning Review',
        subtitle: language === 'he' ? 'בדוק תורים ומטופלים להיום' : 'Check today\'s appointments and patients',
        actions: [
          language === 'he' ? 'הצג תורים להיום' : 'Show today\'s appointments',
          language === 'he' ? 'סקור מטופלים עם התראות' : 'Review patients with alerts',
          language === 'he' ? 'בדוק תוצאות מעבדה חדשות' : 'Check new lab results'
        ],
        prompt: language === 'he' ? 
          'הצג לי את כל התורים להיום ומטופלים שדורשים התייחסות' :
          'Show me today\'s appointments and patients requiring attention'
      });
      
      workflows.push({
        id: 'patient-prep',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11H3v10h6V11z" />
            <path d="M9 7H3v2h6V7z" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
          </svg>
        ),
        title: language === 'he' ? 'הכנה למטופלים' : 'Patient Preparation',
        subtitle: language === 'he' ? 'סקור היסטוריה רפואית' : 'Review medical histories',
        actions: [
          language === 'he' ? 'הצג מטופל הבא' : 'Show next patient',
          language === 'he' ? 'סקור היסטוריה רפואית' : 'Review medical history',
          language === 'he' ? 'הכן תיק מטופל' : 'Prepare patient file'
        ],
        prompt: language === 'he' ?
          'הצג לי את המטופל הבא ואת ההיסטוריה הרפואית שלו' :
          'Show me the next patient and their medical history'
      });
    }
    
    // Afternoon workflows (12 PM - 6 PM) - removed to make them always available
    
    // Evening workflows (6 PM - 10 PM)
    if (hour >= 18 && hour < 22) {
      workflows.push({
        id: 'daily-summary',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
        title: language === 'he' ? 'סיכום יומי' : 'Daily Summary',
        subtitle: language === 'he' ? 'סקור את פעילות היום' : 'Review today\'s activity',
        actions: [
          language === 'he' ? 'סיכום מטופלים' : 'Patient summary',
          language === 'he' ? 'משימות שהושלמו' : 'Completed tasks',
          language === 'he' ? 'התראות פעילות' : 'Active alerts'
        ],
        prompt: language === 'he' ?
          'הצג סיכום של הפעילות היומית' :
          'Show me a summary of today\'s activity'
      });
      
      workflows.push({
        id: 'tomorrow-prep',
        icon: (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
        title: language === 'he' ? 'הכנה למחר' : 'Tomorrow Preparation',
        subtitle: language === 'he' ? 'סקור תורים למחר' : 'Review tomorrow\'s appointments',
        actions: [
          language === 'he' ? 'תורים למחר' : 'Tomorrow\'s appointments',
          language === 'he' ? 'משימות ממתינות' : 'Pending tasks',
          language === 'he' ? 'הכן רשימות' : 'Prepare lists'
        ],
        prompt: language === 'he' ?
          'הצג לי את התורים והמשימות למחר' :
          'Show me tomorrow\'s appointments and tasks'
      });
    }
    
    // Always available workflows - Add Data first
    workflows.push({
      id: 'add-data',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      title: language === 'he' ? 'הוספת נתונים' : 'Add Data',
      subtitle: language === 'he' ? 'הוסף מטופל או תור חדש' : 'Add new patient or appointment',
      actions: [
        language === 'he' ? 'מטופל חדש' : 'New patient',
        language === 'he' ? 'תור חדש' : 'New appointment',
        language === 'he' ? 'מסמך חדש' : 'New document'
      ],
      prompt: language === 'he' ?
        'אני רוצה להוסיף מטופל חדש' :
        'I want to add a new patient'
    });

    workflows.push({
      id: 'quick-search',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      ),
      title: language === 'he' ? 'חיפוש מהיר' : 'Quick Search',
      subtitle: language === 'he' ? 'מצא מטופל או מסמך' : 'Find patient or document',
      actions: [
        language === 'he' ? 'חפש מטופל' : 'Search patient',
        language === 'he' ? 'חפש מסמך' : 'Search document',
        language === 'he' ? 'חפש תוצאות' : 'Search results'
      ],
      prompt: language === 'he' ?
        'חפש מטופל בשם' :
        'Search for patient by name'
    });

    workflows.push({
      id: 'follow-up',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      ),
      title: language === 'he' ? 'מעקב מטופלים' : 'Patient Follow-up',
      subtitle: language === 'he' ? 'בדוק מטופלים למעקב' : 'Check patients for follow-up',
      actions: [
        language === 'he' ? 'רשימת מטופלים למעקב' : 'Follow-up patient list',
        language === 'he' ? 'שלח תזכורות' : 'Send reminders',
        language === 'he' ? 'קבע תורי מעקב' : 'Schedule follow-ups'
      ],
      prompt: language === 'he' ?
        'הצג לי מטופלים שצריכים מעקב השבוע' :
        'Show me patients needing follow-up this week'
    });

    workflows.push({
      id: 'documentation',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      title: language === 'he' ? 'תיעוד ועדכון' : 'Documentation & Updates',
      subtitle: language === 'he' ? 'עדכן רשומות מטופלים' : 'Update patient records',
      actions: [
        language === 'he' ? 'הוסף סיכום ביקור' : 'Add visit summary',
        language === 'he' ? 'עדכן תרופות' : 'Update medications',
        language === 'he' ? 'הוסף תוצאות בדיקות' : 'Add test results'
      ],
      prompt: language === 'he' ?
        'אני רוצה לעדכן רשומות מטופל' :
        'I want to update patient records'
    });
    
    return workflows;
  };
  
  useEffect(() => {
    setSuggestions(getProactiveSuggestions());
    
    // Update suggestions every minute to reflect time changes
    const interval = setInterval(() => {
      setSuggestions(getProactiveSuggestions());
    }, 60000);
    
    return () => clearInterval(interval);
  }, [language]);
  
  const handleWorkflowClick = (workflow) => {
    setCurrentWorkflow(workflow);
    // Send the prompt to the chat
    if (onSendMessage) {
      onSendMessage(workflow.prompt);
    }
  };
  
  // Get gradient colors based on workflow type
  const getWorkflowGradient = (workflowId) => {
    const gradients = {
      'morning-review': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'patient-prep': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'documentation': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'follow-up': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'daily-summary': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'tomorrow-prep': 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'quick-search': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'add-data': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    };
    return gradients[workflowId] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      direction: isRTL ? 'rtl' : 'ltr',
      padding: '4px',
      paddingBottom: '40px',
      height: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      flex: 1,
      backgroundColor: 'inherit',
      scrollbarWidth: 'none', // Firefox
      msOverflowStyle: 'none'  // IE/Edge
    },

    workflowCard: {
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '12px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      position: 'relative',
      overflow: 'visible',
      minHeight: 'auto',
      flexShrink: 0,
      width: '100%',
      boxSizing: 'border-box'
    },
    
    workflowIcon: {
      fontSize: '24px',
      minWidth: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      color: '#ffffff'
    },
    
    workflowContent: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      width: '100%'
    },
    
    workflowTitle: {
      fontSize: '14px',
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: '4px',
      letterSpacing: '0.2px'
    },
    
    workflowSubtitle: {
      fontSize: '12px',
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: '8px',
      lineHeight: '1.4'
    },
    
    actionList: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      marginTop: '8px',
      width: '100%'
    },
    
    actionChip: {
      fontSize: '10px',
      padding: '4px 8px',
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '12px',
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '500',
      letterSpacing: '0.3px'
    },
    
    helpText: {
      fontSize: '11px',
      color: 'rgba(255, 255, 255, 0.5)',
      textAlign: 'center',
      padding: '12px 8px 8px',
      letterSpacing: '0.3px'
    },
    
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: '3px',
      borderRadius: '12px 0 0 12px'
    }
  };
  
  return (
    <div className="workflow-suggestions-container" style={styles.container}>
      <div style={styles.helpText}>
        {language === 'he' ? 
          'לחץ על הצעה כדי להתחיל זרימת עבודה' : 
          'Click a suggestion to start workflow'}
      </div>
      
      {suggestions.map((workflow) => (
        <div
          key={workflow.id}
          style={styles.workflowCard}
          onClick={() => handleWorkflowClick(workflow)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Colored accent bar */}
          <div style={{
            ...styles.accentBar,
            background: getWorkflowGradient(workflow.id)
          }} />
          
          <div style={styles.workflowIcon}>{workflow.icon}</div>
          <div style={styles.workflowContent}>
            <div style={styles.workflowTitle}>{workflow.title}</div>
            <div style={styles.workflowSubtitle}>{workflow.subtitle}</div>
            <div style={styles.actionList}>
              {workflow.actions.map((action, idx) => (
                <span key={idx} style={styles.actionChip}>{action}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default WorkflowSuggestions;