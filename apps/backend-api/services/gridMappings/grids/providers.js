module.exports = {
  title: '👨‍⚕️ Providers',
  columns: ['Date', 'Primary', 'Consulting', 'Specialties'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => {
      // Build specialties display
      const specialties = [];

      // Add primary specialty if present
      if (entry.primarySpecialty) {
        specialties.push(`Primary: ${entry.primarySpecialty}`);
      }

      // Add consulting specialties if present
      if (entry.consultingSpecialties && Array.isArray(entry.consultingSpecialties) && entry.consultingSpecialties.length > 0) {
        specialties.push(`Consulting: ${entry.consultingSpecialties.join(', ')}`);
      }

      // Fallback to generic specialty field
      if (specialties.length === 0 && (entry.specialty || entry.field)) {
        specialties.push(getValue(entry.specialty || entry.field));
      }

      return {
        Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
        Primary: getValue(entry.primary || entry.providerName || entry.name),
        Consulting: entry.consulting && Array.isArray(entry.consulting) && entry.consulting.length > 0
          ? entry.consulting.join(', ')
          : '-',
        Specialties: specialties.length > 0 ? specialties.join('\n') : '-'
      };
    });
  }
};
