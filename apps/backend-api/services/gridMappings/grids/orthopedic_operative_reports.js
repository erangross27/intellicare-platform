module.exports = {
  title: '🦴 Orthopedics',
  columns: ['Date', 'Chief Complaint', 'Procedure', 'Plan', 'Orthopedist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Chief Complaint': getValue(entry.chiefComplaint || entry.reason || entry.injury),
      Procedure: getValue(entry.procedure || entry.operation),
      Plan: getValue(entry.plan || entry.treatment),
      Orthopedist: getValue(entry.provider || entry.surgeon)
    }));
  }
};
