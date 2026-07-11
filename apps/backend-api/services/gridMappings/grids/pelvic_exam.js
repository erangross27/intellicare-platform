module.exports = {
  title: '🩺 Pelvic Exam',
  columns: ['Date', 'External', 'Speculum', 'Bimanual', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      External: getValue(entry.external || entry.externalExam),
      Speculum: getValue(entry.speculum || entry.speculumExam),
      Bimanual: getValue(entry.bimanual || entry.bimanualExam),
      Provider: getValue(entry.provider)
    }));
  }
};
