module.exports = {
  title: '👥 Peer Support',
  columns: ['Date', 'Support Type', 'Topics', 'Attendance', 'Facilitator'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Support Type': getValue(entry.supportType || entry.type),
      Topics: getValue(entry.topics || entry.discussion),
      Attendance: getValue(entry.attendance || entry.participation),
      Facilitator: getValue(entry.facilitator || entry.provider)
    }));
  }
};
