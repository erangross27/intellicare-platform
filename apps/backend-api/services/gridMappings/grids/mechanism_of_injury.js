module.exports = {
  title: '🤕 Mechanism of Injury',
  columns: ['Date', 'Mechanism', 'Forces', 'Associated Injuries', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Mechanism: getValue(entry.mechanism || entry.howOccurred),
      Forces: getValue(entry.forces || entry.energyTransfer),
      'Associated Injuries': getValue(entry.associatedInjuries || entry.otherInjuries),
      Provider: getValue(entry.provider)
    }));
  }
};
