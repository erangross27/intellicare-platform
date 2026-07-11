module.exports = {
  title: '🫘 Polycystic Kidney Disease',
  columns: ['Date', 'Kidney Size', 'Cyst Count', 'Complications', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Kidney Size': getValue(entry.kidneySize || entry.size),
      'Cyst Count': getValue(entry.cystCount || entry.cysts),
      Complications: getValue(entry.complications || entry.issues),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
