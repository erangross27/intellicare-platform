module.exports = {
  title: '🤝 Support Groups',
  columns: ['Date', 'Group Type', 'Session Topic', 'Attendance', 'Facilitator'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Group Type': getValue(entry.groupType || entry.type),
      'Session Topic': getValue(entry.sessionTopic || entry.topic),
      Attendance: getValue(entry.attendance || entry.participated),
      Facilitator: getValue(entry.facilitator || entry.provider)
    }));
  }
};
