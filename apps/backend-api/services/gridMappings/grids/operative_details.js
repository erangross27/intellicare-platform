module.exports = {
  title: '🔪 Operative Details',
  columns: ['Date', 'Procedure', 'Duration', 'Blood Loss', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      Duration: getValue(entry.duration || entry.operativeTime),
      'Blood Loss': getValue(entry.bloodLoss || entry.ebl),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
