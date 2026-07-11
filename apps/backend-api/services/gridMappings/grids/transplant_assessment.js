module.exports = {
  title: '🫘 Transplant Assessment',
  columns: ['Date', 'Organ', 'Candidacy', 'Status', 'Transplant Specialist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Organ: getValue(entry.organ || entry.organType),
      Candidacy: getValue(entry.candidacy || entry.eligibility),
      Status: getValue(entry.status || entry.listingStatus),
      'Transplant Specialist': getValue(entry.transplantSpecialist || entry.provider)
    }));
  }
};
