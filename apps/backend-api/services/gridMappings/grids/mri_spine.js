module.exports = {
  title: '🦴 MRI Spine',
  columns: ['Date', 'Level', 'Indication', 'Findings', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Level: getValue(entry.level || entry.spineLevel),
      Indication: getValue(entry.indication || entry.reason),
      Findings: getValue(entry.findings || entry.description),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
