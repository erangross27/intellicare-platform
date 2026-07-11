module.exports = {
  title: '🩺 Dialysis Planning',
  columns: ['Date', 'Modality', 'Access Type', 'Schedule', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Modality: getValue(entry.modality || entry.dialysisType),
      'Access Type': getValue(entry.accessType || entry.access),
      Schedule: getValue(entry.schedule || entry.frequency),
      Nephrologist: getValue(entry.provider || entry.nephrologist)
    }));
  }
};
