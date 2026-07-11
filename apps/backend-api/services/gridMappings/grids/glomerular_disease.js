module.exports = {
  title: '🫘 Glomerular Disease',
  columns: ['Date', 'Diagnosis', 'Biopsy Findings', 'Treatment', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Diagnosis: getValue(entry.diagnosis || entry.type),
      'Biopsy Findings': getValue(entry.biopsyFindings || entry.pathology),
      Treatment: getValue(entry.treatment || entry.therapy),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
