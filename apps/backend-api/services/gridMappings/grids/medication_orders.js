module.exports = {
  title: '📋 Medication Orders',
  columns: ['Date', 'Medication', 'Dose', 'Frequency', 'Ordering Provider'],
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
      Frequency: getValue(entry.frequency || entry.schedule),
      provider: getValue(entry.provider || entry.orderingProvider)
    }));
  }
};
