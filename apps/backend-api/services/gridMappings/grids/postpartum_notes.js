module.exports = {
  title: '🤱 Postpartum Notes',
  columns: ['Date', 'Days Postpartum', 'Maternal Status', 'Infant Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Days Postpartum': getValue(entry.daysPostpartum || entry.days),
      'Maternal Status': getValue(entry.maternalStatus || entry.maternal),
      'Infant Status': getValue(entry.infantStatus || entry.infant),
      Provider: getValue(entry.provider)
    }));
  }
};
