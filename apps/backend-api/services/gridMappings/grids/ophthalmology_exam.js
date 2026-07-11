module.exports = {
  title: '👁️ Ophthalmology Exam',
  columns: ['Date', 'Visual Acuity', 'IOP', 'Findings', 'Ophthalmologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Visual Acuity': getValue(entry.visualAcuity || entry.va),
      IOP: getValue(entry.iop || entry.intraocularpressure),
      Findings: getValue(entry.findings || entry.examination),
      Ophthalmologist: getValue(entry.ophthalmologist || entry.provider)
    }));
  }
};
