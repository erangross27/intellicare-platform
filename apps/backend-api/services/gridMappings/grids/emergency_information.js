module.exports = {
  title: '🆘 Emergency Information',
  columns: ['Contact Name', 'Relationship', 'Phone', 'Alternate', 'Notes'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      'Contact Name': getValue(entry.contactName || entry.name),
      Relationship: getValue(entry.relationship || entry.relation),
      Phone: getValue(entry.phone || entry.primaryPhone),
      Alternate: getValue(entry.alternate || entry.alternatePhone),
      Notes: getValue(entry.notes || entry.comments)
    }));
  }
};
