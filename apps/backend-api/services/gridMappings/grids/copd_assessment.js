module.exports = {
  title: '🫁 COPD Assessment',
  columns: ['Date', 'GOLD Stage', 'FEV1', 'Exacerbations', 'Treatment'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'GOLD Stage': getValue(entry.goldStage || entry.stage),
      FEV1: getValue(entry.fev1),
      Exacerbations: getValue(entry.exacerbations),
      Treatment: getValue(entry.treatment || entry.plan)
    }));
  }
};
