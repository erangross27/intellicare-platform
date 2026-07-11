module.exports = {
  title: '📋 Surgical Consent Forms',
  columns: ['Date', 'Procedure', 'Risks Discussed', 'Consent Status', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      'Risks Discussed': getValue(entry.risksDiscussed || entry.risks),
      'Consent Status': getValue(entry.consentStatus || entry.status),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
