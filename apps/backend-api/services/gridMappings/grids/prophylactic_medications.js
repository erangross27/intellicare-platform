module.exports = {
  title: '🛡️ Prophylactic Medications',
  columns: ['Date', 'Medication', 'Indication', 'Duration', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      Indication: getValue(entry.indication || entry.purpose),
      Duration: getValue(entry.duration || entry.timeframe),
      Provider: getValue(entry.provider)
    }));
  }
};
