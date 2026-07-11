module.exports = {
  title: '🫘 Hypertensive Nephropathy',
  columns: ['Date', 'Blood Pressure', 'Proteinuria', 'eGFR', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Blood Pressure': getValue(entry.bloodPressure || entry.bp),
      Proteinuria: getValue(entry.proteinuria || entry.uacr),
      eGFR: getValue(entry.egfr || entry.eGFR),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
