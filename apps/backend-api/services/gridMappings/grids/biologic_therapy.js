module.exports = {
  title: '💉 Biologic Therapy',
  columns: ['Date', 'Biologic', 'Dose', 'Response', 'Next Dose'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Biologic: getValue(entry.biologic || entry.medication || entry.agent),
      Dose: getValue(entry.dose || entry.dosage),
      Response: getValue(entry.response || entry.outcome),
      'Next Dose': entry.nextDose ? new Date(entry.nextDose).toLocaleDateString() : '-'
    }));
  }
};
