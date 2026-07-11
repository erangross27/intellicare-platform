module.exports = {
  title: '📅 Follow-ups',
  columns: ['Date', 'Reason', 'Findings', 'Next Steps', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Reason: getValue(entry.reason || entry.followUpReason),
      Findings: getValue(entry.findings || entry.assessment),
      'Next Steps': getValue(entry.nextSteps || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
