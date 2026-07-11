module.exports = {
  title: '📸 Intraoperative Imaging',
  columns: ['Date', 'Imaging Type', 'Findings', 'Impact on Surgery', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Imaging Type': getValue(entry.imagingType || entry.modality),
      Findings: getValue(entry.findings || entry.results),
      'Impact on Surgery': getValue(entry.impactOnSurgery || entry.surgicalDecision),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
