module.exports = {
  title: '🎗️ Cancer Staging',
  columns: ['Date', 'Cancer Type', 'TNM Stage', 'Overall Stage', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cancer Type': getValue(entry.cancerType || entry.diagnosis),
      'TNM Stage': getValue(entry.tnm || entry.tnmStage),
      'Overall Stage': getValue(entry.stage || entry.overallStage),
      Oncologist: getValue(entry.provider || entry.oncologist)
    }));
  }
};
