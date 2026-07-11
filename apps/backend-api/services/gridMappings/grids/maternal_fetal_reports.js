module.exports = {
  title: '🤰 Maternal-Fetal Reports',
  columns: ['Date', 'Gestational Age', 'Fetal Status', 'Maternal Status', 'Specialist'],
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
      'Fetal Status': getValue(entry.fetalStatus || entry.fetus),
      'Maternal Status': getValue(entry.maternalStatus || entry.maternal),
      Specialist: getValue(entry.specialist || entry.provider)
    }));
  }
};
