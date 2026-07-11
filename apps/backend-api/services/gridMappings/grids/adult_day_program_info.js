module.exports = {
  title: '🏢 Adult Day Program',
  columns: ['Program Name', 'Schedule', 'Services', 'Contact', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Program Name': getValue(entry.programName || entry.name),
      Schedule: getValue(entry.schedule || entry.days),
      Services: getValue(entry.services || entry.activities),
      Contact: getValue(entry.contact || entry.phone),
      Status: getValue(entry.status, 'Active')
    }));
  }
};
