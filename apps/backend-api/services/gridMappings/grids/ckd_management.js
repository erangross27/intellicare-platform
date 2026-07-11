module.exports = {
  title: '🩺 CKD Management',
  columns: ['Date', 'Stage', 'eGFR', 'Interventions', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Stage: getValue(entry.stage || entry.ckdStage),
      eGFR: getValue(entry.egfr || entry.gfr),
      Interventions: getValue(entry.interventions || entry.plan),
      Nephrologist: getValue(entry.provider || entry.nephrologist)
    }));
  }
};
