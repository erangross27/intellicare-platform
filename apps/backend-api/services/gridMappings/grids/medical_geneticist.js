module.exports = {
  title: '🧬 Medical Geneticist',
  columns: ['Date', 'Geneticist Name', 'Consultation Type', 'Findings', 'Recommendations'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Geneticist Name': getValue(entry.geneticistName || entry.provider),
      'Consultation Type': getValue(entry.consultationType || entry.type),
      Findings: getValue(entry.findings || entry.results),
      Recommendations: getValue(entry.recommendations || entry.plan)
    }));
  }
};
