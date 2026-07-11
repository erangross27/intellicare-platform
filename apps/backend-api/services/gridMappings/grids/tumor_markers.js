module.exports = {
  title: '🧬 Tumor Markers',
  columns: ['Date', 'Marker', 'Value', 'Trend', 'Oncologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Marker: getValue(entry.marker || entry.tumorMarker),
      Value: getValue(entry.value || entry.result),
      Trend: getValue(entry.trend || entry.direction),
      Oncologist: getValue(entry.oncologist || entry.provider)
    }));
  }
};
