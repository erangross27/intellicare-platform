module.exports = {
  title: '🤰 MFM Consultation',
  columns: ['Date', 'Gestational Age', 'Indication', 'Recommendations', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Indication: getValue(entry.indication || entry.reason),
      Recommendations: getValue(entry.recommendations || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
