module.exports = {
  title: '🫁 Thoracic Surgery Assessment',
  columns: ['Date', 'Condition', 'Procedure Planned', 'Risks', 'Surgeon'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Condition: getValue(entry.condition || entry.diagnosis),
      'Procedure Planned': getValue(entry.procedurePlanned || entry.procedure),
      Risks: getValue(entry.risks || entry.complications),
      Surgeon: getValue(entry.surgeon || entry.provider)
    }));
  }
};
