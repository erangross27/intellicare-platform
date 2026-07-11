module.exports = {
  title: '💊 Medication Dose Changes',
  columns: ['Date', 'Medication', 'Previous Dose', 'New Dose', 'Provider'],
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
      'Previous Dose': getValue(entry.previousDose || entry.oldDose),
      'New Dose': getValue(entry.newDose || entry.adjustedDose),
      Provider: getValue(entry.provider)
    }));
  }
};
