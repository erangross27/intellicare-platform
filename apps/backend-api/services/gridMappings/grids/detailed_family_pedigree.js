module.exports = {
  title: '👨‍👩‍👧‍👦 Family Pedigree',
  columns: ['Generation', 'Family Member', 'Relationship', 'Conditions', 'Age/Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Generation: getValue(entry.generation || entry.level),
      'Family Member': getValue(entry.familyMember || entry.name),
      Relationship: getValue(entry.relationship || entry.relation),
      Conditions: getValue(entry.conditions || entry.diagnoses),
      'Age/Status': getValue(entry.age || entry.status)
    }));
  }
};
