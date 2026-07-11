module.exports = {
  title: '🧠 Stroke Assessment',
  columns: ['Date', 'Type', 'NIHSS', 'Treatment', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.strokeType),
      NIHSS: getValue(entry.nihss || entry.nihssScore),
      Treatment: getValue(entry.treatment || entry.intervention),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
