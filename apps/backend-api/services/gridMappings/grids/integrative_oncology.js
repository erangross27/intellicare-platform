module.exports = {
  title: '🌿 Integrative Oncology',
  columns: ['Date', 'Modality', 'Purpose', 'Response', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Modality: getValue(entry.modality || entry.therapy),
      Purpose: getValue(entry.purpose || entry.indication),
      Response: getValue(entry.response || entry.outcome),
      Provider: getValue(entry.provider)
    }));
  }
};
