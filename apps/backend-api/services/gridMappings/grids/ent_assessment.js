module.exports = {
  title: '👂 ENT Assessment',
  columns: ['Date', 'Chief Complaint', 'Examination', 'Plan', 'ENT Specialist'],
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
      Examination: getValue(entry.examination || entry.findings),
      Plan: getValue(entry.plan || entry.treatment),
      'ENT Specialist': getValue(entry.provider || entry.ent)
    }));
  }
};
