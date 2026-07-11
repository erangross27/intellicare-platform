module.exports = {
  title: '👨‍👩‍👧‍👦 Extended Family History',
  columns: ['Relationship', 'Name', 'Conditions', 'Age at Onset', 'Living Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Relationship: getValue(entry.relationship || entry.relation),
      Name: getValue(entry.name || entry.familyMember),
      Conditions: getValue(entry.conditions || entry.diagnoses),
      'Age at Onset': getValue(entry.ageAtOnset || entry.age),
      'Living Status': getValue(entry.livingStatus || entry.status)
    }));
  }
};
