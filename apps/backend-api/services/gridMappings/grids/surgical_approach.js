module.exports = {
  title: '🔪 Surgical Approach',
  columns: ['Date', 'Approach', 'Incision', 'Access', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Approach: getValue(entry.approach || entry.technique),
      Incision: getValue(entry.incision || entry.incisionType),
      Access: getValue(entry.access || entry.exposure),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
