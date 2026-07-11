module.exports = {
  title: '🫘 Transplant Evaluation',
  columns: ['Date', 'Status', 'Testing', 'Candidacy', 'Transplant Team'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Status: getValue(entry.status || entry.evaluationStatus),
      Testing: getValue(entry.testing || entry.workup),
      Candidacy: getValue(entry.candidacy || entry.eligibility),
      'Transplant Team': getValue(entry.transplantTeam || entry.provider)
    }));
  }
};
