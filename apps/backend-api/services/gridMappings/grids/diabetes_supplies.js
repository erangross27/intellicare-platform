module.exports = {
  title: '💉 Diabetes Supplies',
  columns: ['Date', 'Supply Type', 'Quantity', 'Next Refill', 'Supplier'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Supply Type': getValue(entry.supplyType || entry.item),
      Quantity: getValue(entry.quantity || entry.amount),
      'Next Refill': entry.nextRefill ? new Date(entry.nextRefill).toLocaleDateString() : '-',
      Supplier: getValue(entry.supplier || entry.pharmacy)
    }));
  }
};
