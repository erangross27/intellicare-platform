module.exports = {
  title: '🤝 Psychosocial Assessment',
  columns: ['Date', 'Social Support', 'Stressors', 'Coping', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Social Support': getValue(entry.socialSupport || entry.support),
      Stressors: getValue(entry.stressors || entry.stresses),
      Coping: getValue(entry.coping || entry.copingMechanisms),
      Provider: getValue(entry.provider)
    }));
  }
};
