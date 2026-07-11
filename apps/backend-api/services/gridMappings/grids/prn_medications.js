module.exports = {
  title: '💊 PRN Medications',
  columns: ['Medication', 'Dose', 'Indication', 'Route', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Medication: getValue(entry.medication || entry.drug),
      Dose: getValue(entry.dose || entry.dosage),
      Indication: getValue(entry.indication || entry.reason),
      Route: getValue(entry.route || entry.administrationRoute),
      Provider: getValue(entry.provider)
    }));
  }
};
