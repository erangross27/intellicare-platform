module.exports = {
  title: '🦷 Oral Surgery Reports',
  columns: ['Date', 'Procedure', 'Site', 'Complications', 'Oral Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Procedure: getValue(entry.procedure || entry.operation),
      Site: getValue(entry.site || entry.location),
      Complications: getValue(entry.complications || entry.issues),
      'Oral Surgeon': getValue(entry.oralSurgeon || entry.provider)
    }));
  }
};
