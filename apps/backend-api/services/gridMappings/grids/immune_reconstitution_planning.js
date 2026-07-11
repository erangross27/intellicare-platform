module.exports = {
  title: '🛡️ Immune Reconstitution Planning',
  columns: ['Date', 'CD4 Count', 'Status', 'Interventions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'CD4 Count': getValue(entry.cd4Count || entry.cd4),
      Status: getValue(entry.status || entry.reconstitutionStatus),
      Interventions: getValue(entry.interventions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
