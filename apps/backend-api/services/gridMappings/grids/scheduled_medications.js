module.exports = {
  title: '📅 Scheduled Medications',
  columns: ['Medication', 'Dose', 'Frequency', 'Route', 'Provider'],
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
      Frequency: getValue(entry.frequency || entry.schedule),
      Route: getValue(entry.route || entry.administrationRoute),
      Provider: getValue(entry.provider)
    }));
  }
};
