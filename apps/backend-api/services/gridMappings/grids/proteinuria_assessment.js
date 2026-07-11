module.exports = {
  title: '🧪 Proteinuria Assessment',
  columns: ['Date', 'Protein Level', 'Collection Method', 'Significance', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Protein Level': getValue(entry.proteinLevel || entry.protein),
      'Collection Method': getValue(entry.collectionMethod || entry.method),
      Significance: getValue(entry.significance || entry.interpretation),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
