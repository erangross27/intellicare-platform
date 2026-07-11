module.exports = {
  title: '📝 Procedure Consent',
  columns: ['Date', 'Procedure', 'Risks Discussed', 'Consent Given', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.procedureName),
      'Risks Discussed': getValue(entry.risksDiscussed || entry.risks),
      'Consent Given': getValue(entry.consentGiven || entry.consent),
      Provider: getValue(entry.provider)
    }));
  }
};
