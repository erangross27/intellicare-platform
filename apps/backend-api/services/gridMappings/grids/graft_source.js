module.exports = {
  title: '🧬 Graft Source',
  columns: ['Date', 'Graft Type', 'Source', 'Site', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Graft Type': getValue(entry.graftType || entry.type),
      Source: getValue(entry.source || entry.origin),
      Site: getValue(entry.site || entry.location),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
