module.exports = {
  title: '👥 Oncology Team',
  columns: ['Date', 'Team Member', 'Role', 'Contact', 'Notes'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Team Member': getValue(entry.teamMember || entry.name),
      Role: getValue(entry.role || entry.specialty),
      Contact: getValue(entry.contact || entry.phone),
      Notes: getValue(entry.notes || entry.comments)
    }));
  }
};
