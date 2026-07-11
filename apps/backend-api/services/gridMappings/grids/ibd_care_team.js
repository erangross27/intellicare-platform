module.exports = {
  title: '👥 IBD Care Team',
  columns: ['Name', 'Role', 'Specialty', 'Contact', 'Status'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Name: getValue(entry.name || entry.provider),
      Role: getValue(entry.role || entry.position),
      Specialty: getValue(entry.specialty || entry.department),
      Contact: getValue(entry.contact || entry.phone),
      Status: getValue(entry.status, 'Active')
    }));
  }
};
