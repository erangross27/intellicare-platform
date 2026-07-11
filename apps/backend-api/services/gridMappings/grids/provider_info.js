module.exports = {
  title: 'ℹ️ Provider Information',
  columns: ['Date', 'Name', 'Specialty', 'Contact', 'Facility'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Name: getValue(entry.name || entry.providerName),
      Specialty: getValue(entry.specialty || entry.field),
      Contact: getValue(entry.contact || entry.phone),
      Facility: getValue(entry.facility || entry.institution)
    }));
  }
};
