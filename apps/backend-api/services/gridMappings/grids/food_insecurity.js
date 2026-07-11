module.exports = {
  title: '🍽️ Food Insecurity',
  columns: ['Date', 'Severity', 'Impact', 'Interventions', 'Case Manager'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Severity: getValue(entry.severity || entry.level),
      Impact: getValue(entry.impact || entry.effect),
      Interventions: getValue(entry.interventions || entry.resources),
      'Case Manager': getValue(entry.caseManager || entry.socialWorker)
    }));
  }
};
