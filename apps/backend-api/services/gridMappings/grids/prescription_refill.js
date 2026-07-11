module.exports = {
  title: '💊 Prescription Refills',
  columns: ['Date', 'Medication', 'Quantity', 'Refills', 'Provider'],
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
      Quantity: getValue(entry.quantity || entry.amount),
      Refills: getValue(entry.refills || entry.refillsAuthorized),
      Provider: getValue(entry.provider)
    }));
  }
};
