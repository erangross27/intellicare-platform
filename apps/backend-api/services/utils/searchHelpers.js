/**
 * SearchHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class SearchHelpers {

    getSearchTimeRange(searchParams, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      if (searchParams.dateFrom && searchParams.dateTo) {
        const fromDate = new Date(searchParams.dateFrom).toLocaleDateString(
          isHebrew ? 'he-IL' : 'en-US'
        );
        const toDate = new Date(searchParams.dateTo).toLocaleDateString(
          isHebrew ? 'he-IL' : 'en-US'
        );
        return `${fromDate} - ${toDate}`;
      }
      
      if (searchParams.dateFrom) {
        const fromDate = new Date(searchParams.dateFrom).toLocaleDateString(
          isHebrew ? 'he-IL' : 'en-US'
        );
        return isHebrew ? `מ-${fromDate}` : `From ${fromDate}`;
      }
      
      if (searchParams.dateTo) {
        const toDate = new Date(searchParams.dateTo).toLocaleDateString(
          isHebrew ? 'he-IL' : 'en-US'
        );
        return isHebrew ? `עד ${toDate}` : `Until ${toDate}`;
      }
      
      return isHebrew ? 'כל הזמנים' : 'All time';
    }

    getMostCommonValue(sessions, field) {
      const counts = {};
      sessions.forEach(session => {
        const value = session[field] || 'unknown';
        counts[value] = (counts[value] || 0) + 1;
      });
      
      return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'unknown');
    }

    generateSearchMessage(sessions, searchParams, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
  
      if (sessions.length === 0) {
        return isHebrew ? 'לא נמצאו שיחות' : 'No sessions found';
      }
  
      let message = isHebrew 
        ? `נמצאו ${sessions.length} שיחות`
        : `Found ${sessions.length} sessions`;
  
      const completedSessions = sessions.filter(s => s.sessionStatus === 'completed').length;
      const activeSessions = sessions.filter(s => s.sessionStatus === 'active').length;
  
      if (completedSessions > 0 || activeSessions > 0) {
        const parts = [];
        if (completedSessions > 0) {
          parts.push(isHebrew ? `${completedSessions} הושלמו` : `${completedSessions} completed`);
        }
        if (activeSessions > 0) {
          parts.push(isHebrew ? `${activeSessions} פעילות` : `${activeSessions} active`);
        }
        message += ` (${parts.join(', ')})`;
      }
  
      return message;
    }
}

module.exports = SearchHelpers;
