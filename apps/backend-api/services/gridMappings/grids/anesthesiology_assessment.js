module.exports = {
  title: '💤 Anesthesiology Assessment',
  columns: ['Date', 'ASA Class', 'Airway Assessment', 'Risks', 'Anesthesiologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'ASA Class': getValue(entry.asaClass || entry.asa),
      'Airway Assessment': getValue(entry.airwayAssessment || entry.airway),
      Risks: getValue(entry.risks || entry.concerns),
      Anesthesiologist: getValue(entry.provider || entry.anesthesiologist)
    }));
  }
};
