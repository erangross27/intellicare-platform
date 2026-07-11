module.exports = {
  title: '🩹 Dermatology',
  columns: ['Date', 'Chief Complaint', 'Skin Findings', 'Treatment', 'Dermatologist'],
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
      'Skin Findings': getValue(entry.findings || entry.description || entry.lesions),
      Treatment: getValue(entry.treatment || entry.plan),
      Dermatologist: getValue(entry.provider || entry.dermatologist)
    }));
  }
};
