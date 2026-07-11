module.exports = {
  title: '🏢 Facility Records',
  columns: ['Date', 'Facility Name', 'Address', 'Encounter Type', 'Department'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Facility Name': getValue(entry.facilityName || entry.name),
      Address: getValue(entry.address || entry.location),
      'Encounter Type': getValue(entry.encounterType || entry.type),
      Department: getValue(entry.department || entry.unit)
    }));
  }
};
