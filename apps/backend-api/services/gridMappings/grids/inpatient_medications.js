module.exports = {
  title: '💊 Inpatient Medications',
  columns: ['Date/Time', 'Medication', 'Dose', 'Route', 'Given By'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      Dose: getValue(entry.dose || entry.dosage),
      Route: getValue(entry.route || entry.administrationRoute),
      'Given By': getValue(entry.givenBy || entry.provider)
    }));
  }
};
