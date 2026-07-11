module.exports = {
  title: '🤰 Obstetric Ultrasound Reports',
  columns: ['Date', 'Gestational Age', 'Fetal Measurements', 'Findings', 'Sonographer'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Gestational Age': getValue(entry.gestationalAge || entry.ga),
      'Fetal Measurements': getValue(entry.fetalMeasurements || entry.measurements),
      Findings: getValue(entry.findings || entry.results),
      Sonographer: getValue(entry.sonographer || entry.provider)
    }));
  }
};
