module.exports = {
  title: '😴 Sleep Study',
  columns: ['Date', 'Study Type', 'AHI', 'Diagnosis', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Study Type': getValue(entry.studyType || entry.test),
      AHI: getValue(entry.ahi || entry.apneaHypopneaIndex),
      Diagnosis: getValue(entry.diagnosis || entry.findings),
      Provider: getValue(entry.provider)
    }));
  }
};
