module.exports = {
  title: '🩹 Injury Assessment',
  columns: ['Date', 'Injury Type', 'Location', 'Severity', 'Treatment'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Injury Type': getValue(entry.injuryType || entry.type),
      Location: getValue(entry.location || entry.site),
      Severity: getValue(entry.severity || entry.grade),
      Treatment: getValue(entry.treatment || entry.intervention)
    }));
  }
};
