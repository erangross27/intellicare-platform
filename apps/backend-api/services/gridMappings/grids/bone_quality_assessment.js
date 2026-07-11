module.exports = {
  title: '🦴 Bone Quality Assessment',
  columns: ['Date', 'Location', 'Quality Grade', 'Findings', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Location: getValue(entry.location || entry.site),
      'Quality Grade': getValue(entry.qualityGrade || entry.grade),
      Findings: getValue(entry.findings || entry.assessment),
      Provider: getValue(entry.provider)
    }));
  }
};
