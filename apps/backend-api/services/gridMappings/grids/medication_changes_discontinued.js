module.exports = {
  title: '💊 Discontinued Medications',
  columns: ['Date', 'Medication', 'Reason', 'Last Dose', 'Provider'],
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
      Reason: getValue(entry.reason || entry.indication),
      'Last Dose': getValue(entry.lastDose || entry.finalDose),
      Provider: getValue(entry.provider)
    }));
  }
};
