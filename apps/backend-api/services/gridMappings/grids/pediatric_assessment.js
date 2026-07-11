module.exports = {
  title: '👶 Pediatric Assessment',
  columns: ['Date', 'Age', 'Chief Complaint', 'Assessment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Age: getValue(entry.age || entry.ageMonths),
      'Chief Complaint': getValue(entry.chiefComplaint || entry.complaint),
      Assessment: getValue(entry.assessment || entry.findings),
      Provider: getValue(entry.provider)
    }));
  }
};
