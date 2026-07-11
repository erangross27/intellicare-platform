module.exports = {
  title: '🫁 Pulmonology',
  columns: ['Date', 'Chief Complaint', 'FEV1', 'Assessment', 'Pulmonologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.reason),
      FEV1: getValue(entry.fev1 || entry.spirometry),
      Assessment: getValue(entry.assessment || entry.impression),
      Pulmonologist: getValue(entry.provider || entry.pulmonologist)
    }));
  }
};
