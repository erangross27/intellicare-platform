module.exports = {
  title: '🌞 Day Programs',
  columns: ['Date', 'Program Name', 'Activities', 'Attendance', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Program Name': getValue(entry.programName || entry.name),
      Activities: getValue(entry.activities || entry.schedule),
      Attendance: getValue(entry.attendance || entry.participation),
      Provider: getValue(entry.provider)
    }));
  }
};
