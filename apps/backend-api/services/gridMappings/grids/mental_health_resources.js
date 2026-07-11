module.exports = {
  title: '🧠 Mental Health Resources',
  columns: ['Date', 'Resource Type', 'Contact Information', 'Services', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Resource Type': getValue(entry.resourceType || entry.type),
      'Contact Information': getValue(entry.contactInformation || entry.contact),
      Services: getValue(entry.services || entry.servicesProvided),
      Provider: getValue(entry.provider)
    }));
  }
};
