module.exports = {
  title: '📋 DNR Orders',
  columns: ['Date', 'Order Type', 'Discussion', 'Witnesses', 'Physician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Order Type': getValue(entry.orderType || entry.type),
      Discussion: getValue(entry.discussion || entry.conversationNotes),
      Witnesses: getValue(entry.witnesses || entry.signatories),
      Physician: getValue(entry.physician || entry.provider)
    }));
  }
};
