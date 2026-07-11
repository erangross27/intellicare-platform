module.exports = {
  title: '🦠 Opportunistic Infections',
  columns: ['Date', 'Infection', 'Treatment', 'Response', 'Prophylaxis'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Infection: getValue(entry.infection || entry.diagnosis),
      Treatment: getValue(entry.treatment || entry.therapy),
      Response: getValue(entry.response || entry.outcome),
      Prophylaxis: getValue(entry.prophylaxis || entry.prevention)
    }));
  }
};
