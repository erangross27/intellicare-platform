module.exports = {
  title: '🔊 POCUS Heart Rate',
  columns: ['Date', 'Heart Rate', 'Gestational Age', 'Image Quality', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Heart Rate': getValue(entry.heartRate || entry.hr),
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      'Image Quality': getValue(entry.imageQuality || entry.quality),
      Provider: getValue(entry.provider)
    }));
  }
};
