module.exports = {
  title: '🔍 Diagnostic Impression',
  columns: ['Date', 'Impression', 'Confidence', 'Differential', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Impression: getValue(entry.impression || entry.diagnosis),
      Confidence: getValue(entry.confidence || entry.certainty),
      Differential: getValue(entry.differential || entry.alternatives),
      Provider: getValue(entry.provider)
    }));
  }
};
