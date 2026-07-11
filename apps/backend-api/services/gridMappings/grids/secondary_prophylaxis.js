module.exports = {
  title: '🛡️ Secondary Prophylaxis',
  columns: ['Date', 'Infection', 'Medication', 'Previous Episode', 'Provider'],
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
      'Previous Episode': getValue(entry.previousEpisode || entry.history),
      Provider: getValue(entry.provider)
    }));
  }
};
