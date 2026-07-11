module.exports = {
  title: '🫃 Extraintestinal Manifestations',
  columns: ['Date', 'System', 'Manifestation', 'Severity', 'Treatment'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      System: getValue(entry.system || entry.organ),
      Manifestation: getValue(entry.manifestation || entry.symptom),
      Severity: getValue(entry.severity),
      Treatment: getValue(entry.treatment || entry.management)
    }));
  }
};
