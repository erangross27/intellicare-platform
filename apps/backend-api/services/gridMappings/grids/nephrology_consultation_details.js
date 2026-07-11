module.exports = {
  title: '🫘 Nephrology Consultation Details',
  columns: ['Date', 'Reason', 'Findings', 'Recommendation', 'Nephrologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Reason: getValue(entry.reason || entry.indication),
      Findings: getValue(entry.findings || entry.assessment),
      Recommendation: getValue(entry.recommendation || entry.plan),
      Nephrologist: getValue(entry.nephrologist || entry.provider)
    }));
  }
};
