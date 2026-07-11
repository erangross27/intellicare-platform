module.exports = {
  title: '☢️ Nuclear Medicine Assessment',
  columns: ['Date', 'Study Type', 'Tracer Used', 'Findings', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Study Type': getValue(entry.studyType || entry.scan),
      'Tracer Used': getValue(entry.tracerUsed || entry.radiotracer),
      Findings: getValue(entry.findings || entry.results),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
