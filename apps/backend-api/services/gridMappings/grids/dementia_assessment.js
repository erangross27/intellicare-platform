module.exports = {
  title: '🧠 Dementia Assessment',
  columns: ['Date', 'Type', 'MMSE/MoCA', 'Stage', 'Neurologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Type: getValue(entry.type || entry.dementiaType),
      'MMSE/MoCA': getValue(entry.mmseMoca || entry.cognitiveScore),
      Stage: getValue(entry.stage || entry.severity),
      Neurologist: getValue(entry.neurologist || entry.provider)
    }));
  }
};
