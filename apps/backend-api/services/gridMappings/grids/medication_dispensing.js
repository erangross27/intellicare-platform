module.exports = {
  title: '💊 Medication Dispensing',
  columns: ['Date/Time', 'Medication', 'Dose', 'Given By', 'Patient Response'],
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
      'Given By': getValue(entry.givenBy || entry.provider),
      response: getValue(entry.response || entry.patientResponse)
    }));
  }
};
