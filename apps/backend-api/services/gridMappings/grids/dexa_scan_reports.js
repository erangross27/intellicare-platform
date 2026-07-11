module.exports = {
  title: '🦴 DEXA Scan Reports',
  columns: ['Date', 'Site', 'T-Score', 'Diagnosis', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Site: getValue(entry.site || entry.location),
      'T-Score': getValue(entry.tScore || entry.tscore),
      Diagnosis: getValue(entry.diagnosis || entry.interpretation),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
