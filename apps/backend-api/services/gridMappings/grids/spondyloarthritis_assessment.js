module.exports = {
  title: '🦴 Spondyloarthritis Assessment',
  columns: ['Date', 'Disease Activity', 'BASDAI Score', 'Treatment', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Disease Activity': getValue(entry.diseaseActivity || entry.activity),
      'BASDAI Score': getValue(entry.basdaiScore || entry.basdai),
      Treatment: getValue(entry.treatment || entry.therapy),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
