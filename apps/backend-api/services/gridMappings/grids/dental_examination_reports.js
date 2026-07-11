module.exports = {
  title: '🦷 Dental Examination Reports',
  columns: ['Date', 'Findings', 'Decay', 'Treatment Plan', 'Dentist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Findings: getValue(entry.findings || entry.examination),
      Decay: getValue(entry.decay || entry.caries),
      'Treatment Plan': getValue(entry.treatmentPlan || entry.plan),
      Dentist: getValue(entry.dentist || entry.provider)
    }));
  }
};
