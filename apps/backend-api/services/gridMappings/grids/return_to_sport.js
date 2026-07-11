module.exports = {
  title: '⚽ Return to Sport',
  columns: ['Date', 'Sport', 'Clearance Level', 'Restrictions', 'Sports Medicine'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Sport: getValue(entry.sport || entry.activity),
      'Clearance Level': getValue(entry.clearanceLevel || entry.status),
      Restrictions: getValue(entry.restrictions || entry.limitations),
      'Sports Medicine': getValue(entry.sportsMedicine || entry.provider)
    }));
  }
};
