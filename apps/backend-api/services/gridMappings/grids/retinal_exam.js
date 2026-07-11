module.exports = {
  title: '👁️ Retinal Exam',
  columns: ['Date', 'Right Eye', 'Left Eye', 'Findings', 'Ophthalmologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Right Eye': getValue(entry.rightEye || entry.od),
      'Left Eye': getValue(entry.leftEye || entry.os),
      Findings: getValue(entry.findings || entry.examination),
      Ophthalmologist: getValue(entry.ophthalmologist || entry.provider)
    }));
  }
};
