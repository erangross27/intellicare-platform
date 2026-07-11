module.exports = {
  title: '💊 Medication Administration Record',
  columns: ['Date/Time', 'Medication', 'Dose', 'Route', 'Nurse'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.dateTime || entry.date ? new Date(entry.dateTime || entry.date).toLocaleString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      Dose: getValue(entry.dose || entry.dosage),
      Route: getValue(entry.route || entry.administrationRoute),
      Nurse: getValue(entry.nurse || entry.provider)
    }));
  }
};
