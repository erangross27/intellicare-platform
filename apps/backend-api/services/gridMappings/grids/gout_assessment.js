module.exports = {
  title: '🦶 Gout Assessment',
  columns: ['Date', 'Affected Joint', 'Uric Acid Level', 'Severity', 'Rheumatologist'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Affected Joint': getValue(entry.affectedJoint || entry.location),
      'Uric Acid Level': getValue(entry.uricAcidLevel || entry.uricAcid),
      Severity: getValue(entry.severity || entry.grade),
      Rheumatologist: getValue(entry.rheumatologist || entry.provider)
    }));
  }
};
