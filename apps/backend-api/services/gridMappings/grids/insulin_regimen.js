module.exports = {
  title: '💉 Insulin Regimen',
  columns: ['Date', 'Insulin Type', 'Dose', 'Timing', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Insulin Type': getValue(entry.insulinType || entry.type),
      Dose: getValue(entry.dose || entry.dosage),
      Timing: getValue(entry.timing || entry.schedule),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
