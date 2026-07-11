module.exports = {
  title: '🔦 Laryngoscopy Reports',
  columns: ['Date', 'Indication', 'Findings', 'Vocal Cords', 'ENT Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Indication: getValue(entry.indication || entry.reason),
      Findings: getValue(entry.findings || entry.results),
      'Vocal Cords': getValue(entry.vocalCords || entry.vocalCordStatus),
      'ENT Specialist': getValue(entry.entSpecialist || entry.provider)
    }));
  }
};
