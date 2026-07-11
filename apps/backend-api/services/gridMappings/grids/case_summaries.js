module.exports = {
  title: '📋 Case Summaries',
  columns: ['Date', 'Diagnosis', 'Treatment', 'Outcome', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Diagnosis: getValue(entry.diagnosis || entry.condition),
      Treatment: getValue(entry.treatment || entry.management),
      Outcome: getValue(entry.outcome || entry.result),
      Provider: getValue(entry.provider)
    }));
  }
};
