module.exports = {
  title: '🤰 Current Pregnancy',
  columns: ['Date', 'Gestational Age', 'Status', 'Complications', 'Next Visit'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.weeks),
      Status: getValue(entry.status || entry.pregnancyStatus),
      Complications: getValue(entry.complications || entry.issues, 'None'),
      'Next Visit': entry.nextVisit ? new Date(entry.nextVisit).toLocaleDateString() : '-'
    }));
  }
};
