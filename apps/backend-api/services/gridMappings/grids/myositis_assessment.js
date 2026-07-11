module.exports = {
  title: '💪 Myositis Assessment',
  columns: ['Date', 'Muscle Groups', 'Weakness Grade', 'CK Level', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Muscle Groups': getValue(entry.muscleGroups || entry.muscles),
      'Weakness Grade': getValue(entry.weaknessGrade || entry.grade),
      'CK Level': getValue(entry.ckLevel || entry.creatineKinase),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
