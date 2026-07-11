module.exports = {
  title: '💉 Blood Sample Collection',
  columns: ['Date/Time', 'Test Ordered', 'Collection Status', 'Phlebotomist', 'Notes'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Test Ordered': getValue(entry.testOrdered || entry.test),
      'Collection Status': getValue(entry.status || entry.collectionStatus),
      Phlebotomist: getValue(entry.phlebotomist || entry.collectedBy),
      Notes: getValue(entry.notes || entry.comments)
    }));
  }
};
