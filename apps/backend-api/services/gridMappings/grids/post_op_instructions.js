module.exports = {
  title: '📋 Post-Op Instructions',
  columns: ['Date', 'Procedure', 'Activity Restrictions', 'Warning Signs', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.surgery),
      'Activity Restrictions': getValue(entry.activityRestrictions || entry.restrictions),
      'Warning Signs': getValue(entry.warningSigns || entry.redFlags),
      Provider: getValue(entry.provider)
    }));
  }
};
