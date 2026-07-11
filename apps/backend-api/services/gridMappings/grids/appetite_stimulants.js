module.exports = {
  title: '💊 Appetite Stimulants',
  columns: ['Date', 'Medication', 'Dose', 'Response', 'Side Effects'],
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
      Dose: getValue(entry.dose || entry.dosage),
      Response: getValue(entry.response || entry.effectiveness),
      'Side Effects': getValue(entry.sideEffects, 'None')
    }));
  }
};
