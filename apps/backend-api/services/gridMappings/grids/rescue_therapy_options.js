module.exports = {
  title: '🚨 Rescue Therapy Options',
  columns: ['Date', 'Medication', 'Indication', 'Dosage', 'Provider'],
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
      Indication: getValue(entry.indication || entry.reason),
      Dosage: getValue(entry.dosage || entry.dose),
      Provider: getValue(entry.provider)
    }));
  }
};
