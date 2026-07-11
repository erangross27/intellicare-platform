module.exports = {
  title: '🛡️ Primary Prophylaxis',
  columns: ['Date', 'Infection', 'Medication', 'Indication', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Infection: getValue(entry.infection || entry.targetInfection),
      Medication: getValue(entry.medication || entry.prophylaxisDrug),
      Indication: getValue(entry.indication || entry.reason),
      Provider: getValue(entry.provider)
    }));
  }
};
