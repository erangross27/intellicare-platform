module.exports = {
  title: '💊 Polypharmacy Reviews',
  columns: ['Date', 'Total Medications', 'Interactions', 'Recommendations', 'Pharmacist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Total Medications': getValue(entry.totalMedications || entry.medicationCount),
      Interactions: getValue(entry.interactions || entry.drugInteractions),
      Recommendations: getValue(entry.recommendations || entry.suggestions),
      Pharmacist: getValue(entry.pharmacist || entry.provider)
    }));
  }
};
