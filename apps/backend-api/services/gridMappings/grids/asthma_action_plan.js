module.exports = {
  title: '🫁 Asthma Action Plan',
  columns: ['Date', 'Zone', 'Symptoms', 'Medications', 'Actions'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Zone: getValue(entry.zone || entry.color),
      Symptoms: getValue(entry.symptoms),
      Medications: getValue(entry.medications || entry.meds),
      Actions: getValue(entry.actions || entry.instructions)
    }));
  }
};
