module.exports = {
  title: '🩸 Hematology',
  columns: ['Date', 'Chief Complaint', 'CBC', 'Assessment', 'Hematologist'],
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
      CBC: getValue(entry.cbc || entry.hemoglobin),
      Assessment: getValue(entry.assessment || entry.impression),
      Hematologist: getValue(entry.provider || entry.hematologist)
    }));
  }
};
