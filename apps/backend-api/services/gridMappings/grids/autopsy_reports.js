module.exports = {
  title: '🔬 Autopsy Reports',
  columns: ['Date', 'Cause of Death', 'Significant Findings', 'Contributing Factors', 'Pathologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Cause of Death': getValue(entry.causeOfDeath || entry.cause),
      'Significant Findings': getValue(entry.significantFindings || entry.findings),
      'Contributing Factors': getValue(entry.contributingFactors || entry.contributingCauses),
      Pathologist: getValue(entry.pathologist || entry.provider)
    }));
  }
};
