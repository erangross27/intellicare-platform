module.exports = {
  title: '😖 Pain Management Notes',
  columns: ['Date', 'Pain Level', 'Treatment', 'Response', 'Pain Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Pain Level': getValue(entry.painLevel || entry.pain),
      Treatment: getValue(entry.treatment || entry.interventions),
      Response: getValue(entry.response || entry.outcome),
      'Pain Specialist': getValue(entry.painSpecialist || entry.provider)
    }));
  }
};
