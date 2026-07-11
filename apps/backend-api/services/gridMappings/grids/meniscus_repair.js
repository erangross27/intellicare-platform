module.exports = {
  title: '🦴 Meniscus Repair',
  columns: ['Date', 'Location', 'Tear Pattern', 'Repair Type', 'Orthopedic Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Location: getValue(entry.location || entry.site),
      'Tear Pattern': getValue(entry.tearPattern || entry.type),
      'Repair Type': getValue(entry.repairType || entry.technique),
      'Orthopedic Surgeon': getValue(entry.orthopedicSurgeon || entry.provider)
    }));
  }
};
