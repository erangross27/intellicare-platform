module.exports = {
  title: '🔍 Intraoperative Findings',
  columns: ['Date', 'Findings', 'Anatomical Variations', 'Complications', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Findings: getValue(entry.findings || entry.observations),
      'Anatomical Variations': getValue(entry.anatomicalVariations || entry.variations),
      Complications: getValue(entry.complications || entry.issues),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
