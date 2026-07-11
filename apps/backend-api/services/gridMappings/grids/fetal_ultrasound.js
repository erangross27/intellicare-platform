module.exports = {
  title: '🤰 Fetal Ultrasound',
  columns: ['Date', 'Gestational Age', 'Biometry', 'Anatomy', 'Impression'],
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
      Biometry: getValue(entry.biometry || entry.measurements),
      Anatomy: getValue(entry.anatomy || entry.anatomyStatus),
      Impression: getValue(entry.impression || entry.findings)
    }));
  }
};
