module.exports = {
  title: '💊 Respiratory Medications',
  columns: ['Date', 'Medication', 'Dosage', 'Route', 'Provider'],
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
      Dosage: getValue(entry.dosage || entry.dose),
      Route: getValue(entry.route || entry.administration),
      Provider: getValue(entry.provider)
    }));
  }
};
