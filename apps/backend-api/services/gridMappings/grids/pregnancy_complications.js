module.exports = {
  title: '⚠️ Pregnancy Complications',
  columns: ['Date', 'Gestational Age', 'Complication', 'Management', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      Complication: getValue(entry.complication || entry.issue),
      Management: getValue(entry.management || entry.treatment),
      Provider: getValue(entry.provider)
    }));
  }
};
