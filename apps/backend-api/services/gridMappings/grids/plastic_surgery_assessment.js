module.exports = {
  title: '✨ Plastic Surgery Assessment',
  columns: ['Date', 'Area of Concern', 'Procedure Planned', 'Risks', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Area of Concern': getValue(entry.areaOfConcern || entry.site),
      'Procedure Planned': getValue(entry.procedurePlanned || entry.procedure),
      Risks: getValue(entry.risks || entry.complications),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
