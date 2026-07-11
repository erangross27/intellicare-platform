module.exports = {
  title: '📞 Post-Discharge Call',
  columns: ['Date', 'Concerns', 'Medications', 'Follow-up', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Concerns: getValue(entry.concerns || entry.issues),
      Medications: getValue(entry.medications || entry.medicationCompliance),
      'Follow-up': getValue(entry.followUp || entry.appointments),
      Provider: getValue(entry.provider)
    }));
  }
};
