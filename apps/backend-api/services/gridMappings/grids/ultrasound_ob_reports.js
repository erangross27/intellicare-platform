module.exports = {
  title: '🔊 OB Ultrasound Reports',
  columns: ['Date', 'Gestational Age', 'Biometry', 'Anatomy', 'Sonographer'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Biometry: getValue(entry.biometry || entry.measurements),
      Anatomy: getValue(entry.anatomy || entry.anatomyReview),
      Sonographer: getValue(entry.sonographer || entry.provider)
    }));
  }
};
