module.exports = {
  title: '💧 Dialysis Prescription',
  columns: ['Date', 'Frequency', 'Duration', 'Blood Flow Rate', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Frequency: getValue(entry.frequency || entry.sessionsPerWeek),
      Duration: getValue(entry.duration || entry.treatmentTime),
      'Blood Flow Rate': getValue(entry.bloodFlowRate || entry.bfr),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
