module.exports = {
  title: '🧠 Neurological Findings',
  columns: ['Date', 'Finding', 'Location', 'Severity', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Finding: getValue(entry.finding || entry.observation),
      Location: getValue(entry.location || entry.site),
      Severity: getValue(entry.severity || entry.grade),
      Provider: getValue(entry.provider)
    }));
  }
};
