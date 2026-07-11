module.exports = {
  title: '🦋 Thyroid Management',
  columns: ['Date', 'TSH Level', 'Medication', 'Dosage', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'TSH Level': getValue(entry.tshLevel || entry.tsh),
      Medication: getValue(entry.medication || entry.drug),
      Dosage: getValue(entry.dosage || entry.dose),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
