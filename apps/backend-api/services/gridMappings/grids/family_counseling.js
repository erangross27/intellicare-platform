module.exports = {
  title: '👨‍👩‍👧 Family Counseling',
  columns: ['Date', 'Session', 'Topics', 'Progress', 'Counselor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Session: getValue(entry.session || entry.sessionNumber),
      Topics: getValue(entry.topics || entry.focus),
      Progress: getValue(entry.progress || entry.outcome),
      Counselor: getValue(entry.counselor || entry.provider)
    }));
  }
};
