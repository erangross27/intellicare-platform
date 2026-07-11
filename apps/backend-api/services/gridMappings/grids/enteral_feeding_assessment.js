module.exports = {
  title: 'Enteral Feeding Assessment',
  columns: ['Date', 'Feeding Route', 'Formula', 'Rate', 'Caloric Goal'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.assessmentDate ? new Date(entry.assessmentDate).toLocaleDateString() : '-',
      'Feeding Route': getValue(entry.feedingRouteType),
      Formula: getValue(entry.formulaType),
      Rate: getValue(entry.feedingRate),
      'Caloric Goal': getValue(entry.targetCaloricGoal)
    }));
  }
};
