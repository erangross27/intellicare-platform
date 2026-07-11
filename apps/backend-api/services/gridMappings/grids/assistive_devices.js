module.exports = {
  title: '🦽 Assistive Devices',
  columns: ['Date', 'Device Type', 'Purpose', 'Training', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Device Type': getValue(entry.deviceType || entry.device || entry.type),
      Purpose: getValue(entry.purpose || entry.indication),
      Training: getValue(entry.training || entry.education, 'Completed'),
      Status: getValue(entry.status, 'In Use')
    }));
  }
};
