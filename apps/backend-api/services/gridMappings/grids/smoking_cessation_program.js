module.exports = {
  title: '🚭 Smoking Cessation Program',
  columns: ['Date', 'Stage', 'Interventions', 'Progress', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Stage: getValue(entry.stage || entry.quitStage),
      Interventions: getValue(entry.interventions || entry.treatment),
      Progress: getValue(entry.progress || entry.status),
      Provider: getValue(entry.provider)
    }));
  }
};
