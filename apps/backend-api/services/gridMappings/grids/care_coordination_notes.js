module.exports = {
  title: '🤝 Care Coordination Notes',
  columns: ['Date', 'Services Coordinated', 'Providers Involved', 'Plan', 'Care Coordinator'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Services Coordinated': getValue(entry.servicesCoordinated || entry.services),
      'Providers Involved': getValue(entry.providersInvolved || entry.providers),
      Plan: getValue(entry.plan || entry.careplan),
      'Care Coordinator': getValue(entry.careCoordinator || entry.coordinator)
    }));
  }
};
