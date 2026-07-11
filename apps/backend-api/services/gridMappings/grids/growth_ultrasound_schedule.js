module.exports = {
  title: '📅 Growth Ultrasound Schedule',
  columns: ['Date', 'Gestational Age', 'Indication', 'Next Scheduled', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.weeks),
      Indication: getValue(entry.indication || entry.reason),
      'Next Scheduled': entry.nextScheduled ? new Date(entry.nextScheduled).toLocaleDateString() : '-',
      Provider: getValue(entry.provider)
    }));
  }
};
