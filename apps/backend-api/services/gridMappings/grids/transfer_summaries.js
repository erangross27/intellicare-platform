module.exports = {
  title: '📋 Transfer Summaries',
  columns: ['Date', 'From Facility', 'To Facility', 'Reason', 'Condition'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'From Facility': getValue(entry.fromFacility || entry.transferFrom),
      'To Facility': getValue(entry.toFacility || entry.transferTo),
      Reason: getValue(entry.reason || entry.transferReason),
      Condition: getValue(entry.condition || entry.patientCondition)
    }));
  }
};
