module.exports = {
  title: '🩸 First Trimester Bleeding',
  columns: ['Date', 'Amount', 'Duration', 'Associated Symptoms', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Amount: getValue(entry.amount || entry.severity),
      Duration: getValue(entry.duration || entry.length),
      'Associated Symptoms': getValue(entry.associatedSymptoms || entry.symptoms),
      Provider: getValue(entry.provider)
    }));
  }
};
