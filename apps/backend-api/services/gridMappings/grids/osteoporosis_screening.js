module.exports = {
  title: '🦴 Osteoporosis Screening',
  columns: ['Date', 'T-Score', 'Site', 'Interpretation', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'T-Score': getValue(entry.tScore || entry.score),
      Site: getValue(entry.site || entry.location),
      Interpretation: getValue(entry.interpretation || entry.diagnosis),
      Provider: getValue(entry.provider)
    }));
  }
};
