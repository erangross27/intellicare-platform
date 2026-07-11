module.exports = {
  title: '👥 Surgical Team',
  columns: ['Date', 'Role', 'Name', 'Specialty', 'Contact'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Role: getValue(entry.role || entry.position),
      Name: getValue(entry.name || entry.provider),
      Specialty: getValue(entry.specialty || entry.department),
      Contact: getValue(entry.contact || entry.phone)
    }));
  }
};
