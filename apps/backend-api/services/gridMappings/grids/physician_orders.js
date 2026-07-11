module.exports = {
  title: '📋 Physician Orders',
  columns: ['Date/Time', 'Order Type', 'Details', 'Status', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Date/Time': entry.date ? new Date(entry.date).toLocaleString() : '-',
      'Order Type': getValue(entry.orderType || entry.type),
      Details: getValue(entry.details || entry.order),
      Status: getValue(entry.status || entry.orderStatus),
      Provider: getValue(entry.provider)
    }));
  }
};
