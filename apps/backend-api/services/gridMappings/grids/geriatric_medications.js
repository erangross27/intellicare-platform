module.exports = {
  title: '👴 Geriatric Medications',
  columns: ['Date', 'Medication', 'Beers Criteria', 'Risk Assessment', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Medication: getValue(entry.medication || entry.drug),
      'Beers Criteria': getValue(entry.beersCriteria || entry.beers),
      'Risk Assessment': getValue(entry.riskAssessment || entry.risk),
      Provider: getValue(entry.provider)
    }));
  }
};
