module.exports = {
  title: '🧠 Genetics Psychosocial Assessment',
  columns: ['Date', 'Coping Mechanisms', 'Family Impact', 'Support Needs', 'Counselor'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Coping Mechanisms': getValue(entry.copingMechanisms || entry.coping),
      'Family Impact': getValue(entry.familyImpact || entry.impact),
      'Support Needs': getValue(entry.supportNeeds || entry.needs),
      Counselor: getValue(entry.counselor || entry.provider)
    }));
  }
};
