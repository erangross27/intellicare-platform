module.exports = {
  title: '🎗️ Staging Summary',
  columns: ['Date', 'Cancer Type', 'Stage', 'TNM', 'Oncologist'],
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
      Stage: getValue(entry.stage || entry.staging),
      TNM: getValue(entry.tnm || entry.tnmClassification),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
