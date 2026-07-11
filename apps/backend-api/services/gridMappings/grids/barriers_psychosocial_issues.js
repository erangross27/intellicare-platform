module.exports = {
  title: '⚠️ Psychosocial Barriers',
  columns: ['Date', 'Barrier Type', 'Impact', 'Interventions', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Barrier Type': getValue(entry.barrierType || entry.barrier || entry.issue),
      Impact: getValue(entry.impact || entry.severity),
      Interventions: getValue(entry.interventions || entry.plan),
      Status: getValue(entry.status || entry.resolved)
    }));
  }
};
