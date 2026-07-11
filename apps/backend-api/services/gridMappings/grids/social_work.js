module.exports = {
  title: '🤝 Social Work',
  columns: ['Date', 'Service', 'Issues Addressed', 'Outcome', 'Social Worker'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Service: getValue(entry.service || entry.intervention),
      'Issues Addressed': getValue(entry.issuesAddressed || entry.concerns),
      Outcome: getValue(entry.outcome || entry.result),
      'Social Worker': getValue(entry.socialWorker || entry.provider)
    }));
  }
};
