module.exports = {
  title: '🩺 Rectal Exam',
  columns: ['Date', 'Findings', 'Prostate', 'Stool', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Findings: getValue(entry.findings || entry.examination),
      Prostate: getValue(entry.prostate || entry.prostateExam),
      Stool: getValue(entry.stool || entry.stoolCharacteristics),
      Provider: getValue(entry.provider)
    }));
  }
};
