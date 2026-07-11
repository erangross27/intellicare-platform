module.exports = {
  title: '📊 Mayo Score (IBD)',
  columns: ['Date', 'Stool Frequency', 'Rectal Bleeding', 'Endoscopy', 'Total Score'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Stool Frequency': getValue(entry.stoolFrequency || entry.stoolScore),
      'Rectal Bleeding': getValue(entry.rectalBleeding || entry.bleedingScore),
      Endoscopy: getValue(entry.endoscopy || entry.endoscopyScore),
      'Total Score': getValue(entry.totalScore || entry.mayoScore)
    }));
  }
};
