module.exports = {
  title: '🤝 Social Work Notes',
  columns: ['Date', 'Issues Addressed', 'Resources Provided', 'Plan', 'Social Worker'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Issues Addressed': getValue(entry.issuesAddressed || entry.concerns),
      'Resources Provided': getValue(entry.resourcesProvided || entry.resources),
      Plan: getValue(entry.plan || entry.interventions),
      'Social Worker': getValue(entry.socialWorker || entry.provider)
    }));
  }
};
