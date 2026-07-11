module.exports = {
  title: '🔬 PET Scan',
  columns: ['Date', 'Indication', 'Findings', 'SUV Max', 'Radiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Findings: getValue(entry.findings || entry.results),
      'SUV Max': getValue(entry.suvMax || entry.standardizedUptakeValue),
      Radiologist: getValue(entry.radiologist || entry.provider)
    }));
  }
};
