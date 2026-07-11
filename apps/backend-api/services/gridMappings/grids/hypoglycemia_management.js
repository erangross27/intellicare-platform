module.exports = {
  title: '📉 Hypoglycemia Management',
  columns: ['Date/Time', 'Glucose Level', 'Symptoms', 'Treatment', 'Resolution'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Glucose Level': getValue(entry.glucoseLevel || entry.glucose),
      Symptoms: getValue(entry.symptoms),
      Treatment: getValue(entry.treatment || entry.intervention),
      Resolution: getValue(entry.resolution || entry.outcome)
    }));
  }
};
