module.exports = {
  title: '🔌 Access Planning',
  columns: ['Date', 'Access Type', 'Site', 'Scheduled Date', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Access Type': getValue(entry.accessType || entry.type),
      Site: getValue(entry.site || entry.location),
      'Scheduled Date': entry.scheduledDate ? new Date(entry.scheduledDate).toLocaleDateString() : '-',
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
