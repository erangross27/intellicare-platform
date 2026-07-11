module.exports = {
  title: '🫀 Liver Function Assessments',
  columns: ['Date', 'ALT', 'AST', 'Bilirubin', 'Albumin'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      ALT: getValue(entry.alt || entry.ALT),
      AST: getValue(entry.ast || entry.AST),
      Bilirubin: getValue(entry.bilirubin || entry.totalBilirubin),
      Albumin: getValue(entry.albumin || entry.serumAlbumin)
    }));
  }
};
