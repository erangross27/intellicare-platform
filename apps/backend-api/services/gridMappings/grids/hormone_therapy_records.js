module.exports = {
  title: '💉 Hormone Therapy Records',
  columns: ['Date', 'Hormone', 'Dose', 'Route', 'Endocrinologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Hormone: getValue(entry.hormone || entry.medication),
      Dose: getValue(entry.dose || entry.dosage),
      Route: getValue(entry.route || entry.administrationRoute),
      Endocrinologist: getValue(entry.endocrinologist || entry.provider)
    }));
  }
};
