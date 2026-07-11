module.exports = {
  title: '🤰 NT Scan Result',
  columns: ['Date', 'Gestational Age', 'NT Measurement', 'Risk', 'Specialist'],
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
      'NT Measurement': getValue(entry.ntMeasurement || entry.nuchalTranslucency),
      Risk: getValue(entry.risk || entry.riskAssessment),
      Specialist: getValue(entry.specialist || entry.provider)
    }));
  }
};
