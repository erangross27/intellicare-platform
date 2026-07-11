/**
 * ChatHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class ChatHelpers {

    generateSessionTopic(initialMessage, practiceContext) {
      if (!initialMessage) return 'General Consultation';
      
      const isHebrew = practiceContext.language === 'he';
      const message = initialMessage.toLowerCase();
      
      // Common medical topics
      if (message.includes('pain') || message.includes('hurt') || message.includes('כאב')) {
        return isHebrew ? 'כאב ותלונות' : 'Pain Management';
      }
      if (message.includes('fever') || message.includes('temperature') || message.includes('חום')) {
        return isHebrew ? 'חום ותסמינים' : 'Fever and Symptoms';
      }
      if (message.includes('medication') || message.includes('prescription') || message.includes('תרופה')) {
        return isHebrew ? 'תרופות ומרשמים' : 'Medication Consultation';
      }
      if (message.includes('follow') || message.includes('check') || message.includes('מעקב')) {
        return isHebrew ? 'מעקב רפואי' : 'Follow-up Care';
      }
      if (message.includes('emergency') || message.includes('urgent') || message.includes('חירום')) {
        return isHebrew ? 'טיפול חירום' : 'Emergency Consultation';
      }
      
      return isHebrew ? 'יעוץ רפואי כללי' : 'General Medical Consultation';
    }

    determinePriority(sessionType, initialMessage) {
      if (sessionType === 'emergency') return 'critical';
      
      if (initialMessage) {
        const message = initialMessage.toLowerCase();
        // Emergency keywords
        if (message.match(/emergency|urgent|severe|critical|חירום|דחוף|קריטי/)) {
          return 'critical';
        }
        // High priority keywords
        if (message.match(/pain|fever|bleeding|difficulty breathing|chest pain|כאב חזה|דימום|קושי נשימה/)) {
          return 'high';
        }
        // Medium priority
        if (message.match(/follow.*up|medication|prescription|test results|תוצאות בדיקה|תרופה|מעקב/)) {
          return 'medium';
        }
      }
      
      return 'low';
    }

    generateSessionSummary(sessionData, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return {
        title: isHebrew ? 'סיכום שיחה' : 'Session Summary',
        topic: sessionData.topic,
        type: sessionData.sessionType,
        priority: sessionData.priority,
        patient: sessionData.medicalContext ? 
          sessionData.medicalContext.patientName : 
          (isHebrew ? 'ללא מטופל משוייך' : 'No patient attached'),
        aiEnabled: sessionData.aiAssistance,
        encrypted: sessionData.encrypted,
        language: sessionData.language,
        createdAt: sessionData.createdAt
      };
    }

    generateChatSessionMessage(sessionData, patient, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      let message = isHebrew 
        ? `שיחה חדשה נוצרה: ${sessionData.topic}`
        : `New chat session created: ${sessionData.topic}`;
      
      if (patient) {
        message += isHebrew 
          ? ` עבור ${patient.firstName} ${patient.lastName}`
          : ` for ${patient.firstName} ${patient.lastName}`;
      }
      
      if (sessionData.priority === 'critical') {
        message += isHebrew ? ' ⚠️ עדיפות גבוהה' : ' ⚠️ High Priority';
      }
      
      return message;
    }

    calculateSessionDuration(startTime, endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const durationMs = end - start;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      
      if (durationMinutes < 60) {
        return `${durationMinutes} minutes`;
      } else {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return `${hours}h ${minutes}m`;
      }
    }

    determineSessionStatus(session) {
      if (session.status === 'ended' || session.endedAt) {
        return 'completed';
      }
      
      const lastActivity = new Date(session.lastActivity || session.createdAt);
      const now = new Date();
      const timeSinceActivity = now - lastActivity;
      
      // Consider session inactive after 30 minutes
      if (timeSinceActivity > 30 * 60 * 1000) {
        return 'inactive';
      }
      
      return session.status || 'active';
    }

    highlightSearchTerms(text, query) {
      if (!text || !query) return text;
      
      const terms = query.split(' ').filter(term => term.length > 2);
      let highlighted = text;
      
      terms.forEach(term => {
        const regex = new RegExp(`(${term})`, 'gi');
        highlighted = highlighted.replace(regex, '**$1**');
      });
      
      return highlighted;
    }

    categorizeSessionTopic(topic) {
      if (!topic) return 'general';
      
      const topicLower = topic.toLowerCase();
      
      if (topicLower.includes('pain') || topicLower.includes('כאב')) return 'pain_management';
      if (topicLower.includes('medication') || topicLower.includes('תרופה')) return 'medication';
      if (topicLower.includes('emergency') || topicLower.includes('חירום')) return 'emergency';
      if (topicLower.includes('follow') || topicLower.includes('מעקב')) return 'follow_up';
      if (topicLower.includes('fever') || topicLower.includes('חום')) return 'symptoms';
      if (topicLower.includes('test') || topicLower.includes('בדיקה')) return 'lab_results';
      
      return 'consultation';
    }

    groupSessionsByTime(sessions, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      const grouped = {
        today: [],
        yesterday: [],
        thisWeek: [],
        thisMonth: [],
        older: []
      };
  
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(thisWeekStart.getDate() - 7);
      const thisMonthStart = new Date(today);
      thisMonthStart.setDate(thisMonthStart.getDate() - 30);
  
      sessions.forEach(session => {
        const sessionDate = new Date(session.createdAt);
        
        if (sessionDate >= today) {
          grouped.today.push(session);
        } else if (sessionDate >= yesterday) {
          grouped.yesterday.push(session);
        } else if (sessionDate >= thisWeekStart) {
          grouped.thisWeek.push(session);
        } else if (sessionDate >= thisMonthStart) {
          grouped.thisMonth.push(session);
        } else {
          grouped.older.push(session);
        }
      });
  
      // Add localized labels
      return {
        [isHebrew ? 'היום' : 'today']: grouped.today,
        [isHebrew ? 'אתמול' : 'yesterday']: grouped.yesterday,
        [isHebrew ? 'השבוע' : 'this_week']: grouped.thisWeek,
        [isHebrew ? 'החודש' : 'this_month']: grouped.thisMonth,
        [isHebrew ? 'ישן יותר' : 'older']: grouped.older
      };
    }

    generateSearchAnalytics(sessions, searchParams, practiceContext) {
      const analytics = {
        totalSessions: sessions.length,
        byStatus: {},
        byType: {},
        byPriority: {},
        byCategory: {},
        averageDuration: 0
      };
  
      let totalDurationMinutes = 0;
  
      sessions.forEach(session => {
        // Count by status
        const status = session.sessionStatus || 'unknown';
        analytics.byStatus[status] = (analytics.byStatus[status] || 0) + 1;
  
        // Count by type
        const type = session.sessionType || 'consultation';
        analytics.byType[type] = (analytics.byType[type] || 0) + 1;
  
        // Count by priority
        const priority = session.priority || 'low';
        analytics.byPriority[priority] = (analytics.byPriority[priority] || 0) + 1;
  
        // Count by category
        const category = session.topicCategory || 'general';
        analytics.byCategory[category] = (analytics.byCategory[category] || 0) + 1;
  
        // Calculate duration
        if (session.duration) {
          const durationStr = session.duration;
          const minutesMatch = durationStr.match(/(\d+)\s*minutes?/);
          const hoursMatch = durationStr.match(/(\d+)h/);
          const hoursMinutesMatch = durationStr.match(/(\d+)m/);
          
          let minutes = 0;
          if (minutesMatch) minutes = parseInt(minutesMatch[1]);
          if (hoursMatch) minutes += parseInt(hoursMatch[1]) * 60;
          if (hoursMinutesMatch && hoursMatch) minutes += parseInt(hoursMinutesMatch[1]);
          
          totalDurationMinutes += minutes;
        }
      });
  
      analytics.averageDuration = sessions.length > 0 ? 
        Math.round(totalDurationMinutes / sessions.length) : 0;
  
      return analytics;
    }

    generateSearchSummary(sessions, searchParams, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      const summary = {
        query: searchParams.query,
        resultsCount: sessions.length,
        timeRange: this.getSearchTimeRange(searchParams, practiceContext),
        mostCommonType: this.getMostCommonValue(sessions, 'sessionType'),
        mostCommonCategory: this.getMostCommonValue(sessions, 'topicCategory')
      };
  
      // Generate summary text
      let summaryText = isHebrew 
        ? `נמצאו ${sessions.length} שיחות`
        : `Found ${sessions.length} sessions`;
  
      if (searchParams.query) {
        summaryText += isHebrew 
          ? ` עבור "${searchParams.query}"`
          : ` for "${searchParams.query}"`;
      }
  
      if (searchParams.patientId) {
        summaryText += isHebrew 
          ? ' עבור מטופל זה'
          : ' for this patient';
      }
  
      summary.text = summaryText;
      return summary;
    }
}

module.exports = ChatHelpers;
