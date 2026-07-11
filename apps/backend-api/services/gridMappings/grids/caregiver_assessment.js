module.exports = {
  title: '👨‍👩‍👧 Caregiver Assessment',
  columns: ['Date', 'Caregiver', 'Burden Level', 'Needs', 'Support Plan'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Caregiver: getValue(entry.caregiver || entry.name),
      'Burden Level': getValue(entry.burdenLevel || entry.zaritScore),
      Needs: getValue(entry.needs || entry.concerns),
      'Support Plan': getValue(entry.supportPlan || entry.interventions)
    }));
  }
};
