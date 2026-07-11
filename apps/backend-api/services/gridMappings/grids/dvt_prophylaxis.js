module.exports = {
  title: '💉 DVT Prophylaxis',
  columns: ['Date', 'Method', 'Medication/Device', 'Risk Score', 'Compliance'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Method: getValue(entry.method || entry.prophylaxisType),
      'Medication/Device': getValue(entry.medication || entry.device || entry.intervention),
      'Risk Score': getValue(entry.riskScore || entry.wells),
      Compliance: getValue(entry.compliance || entry.adherence, 'Yes')
    }));
  }
};
