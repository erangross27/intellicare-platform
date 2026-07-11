module.exports = {
  title: '🩸 Renal Anemia',
  columns: ['Date', 'Hemoglobin', 'ESA Therapy', 'Iron Status', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Hemoglobin: getValue(entry.hemoglobin || entry.hgb),
      'ESA Therapy': getValue(entry.esaTherapy || entry.epo),
      'Iron Status': getValue(entry.ironStatus || entry.iron),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
