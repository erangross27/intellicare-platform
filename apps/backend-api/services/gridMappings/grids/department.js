module.exports = {
  title: '🏥 Department Records',
  columns: ['Date', 'Department', 'Unit', 'Location', 'Encounter Type'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Department: getValue(entry.department || entry.name),
      Unit: getValue(entry.unit || entry.subDepartment),
      Location: getValue(entry.location || entry.facility),
      'Encounter Type': getValue(entry.encounterType || entry.type)
    }));
  }
};
