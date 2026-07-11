module.exports = {
  title: '🩹 Pressure Ulcer Assessment',
  columns: ['Date', 'Location', 'Stage', 'Size', 'Treatment'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Location: getValue(entry.location || entry.site),
      Stage: getValue(entry.stage || entry.woundStage),
      Size: getValue(entry.size || entry.dimensions),
      Treatment: getValue(entry.treatment || entry.woundCare)
    }));
  }
};
