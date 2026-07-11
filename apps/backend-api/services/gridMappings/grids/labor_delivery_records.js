module.exports = {
  title: '🤱 Labor & Delivery Records',
  columns: ['Date', 'Labor Duration', 'Delivery Method', 'Complications', 'Obstetrician'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Labor Duration': getValue(entry.laborDuration || entry.duration),
      'Delivery Method': getValue(entry.deliveryMethod || entry.method),
      Complications: getValue(entry.complications || entry.issues),
      Obstetrician: getValue(entry.obstetrician || entry.provider)
    }));
  }
};
