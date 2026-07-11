module.exports = {
  title: '🫁 Respiratory Therapy',
  columns: ['Date/Time', 'Treatment', 'Oxygen', 'Response', 'Therapist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      Treatment: getValue(entry.treatment || entry.therapy),
      Oxygen: getValue(entry.oxygen || entry.oxygenLevel),
      Response: getValue(entry.response || entry.outcome),
      Therapist: getValue(entry.therapist || entry.provider)
    }));
  }
};
