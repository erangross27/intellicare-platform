module.exports = {
  title: '💊 Medication Reconciliation Forms',
  columns: ['Date', 'Home Medications', 'Hospital Medications', 'Changes', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Home Medications': getValue(entry.homeMedications || entry.home),
      'Hospital Medications': getValue(entry.hospitalMedications || entry.hospital),
      Changes: getValue(entry.changes || entry.modifications),
      Provider: getValue(entry.provider)
    }));
  }
};
