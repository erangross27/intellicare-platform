module.exports = {
  title: '👥 Multidisciplinary Rounds',
  columns: ['Date', 'Participants', 'Discussion', 'Decisions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Participants: getValue(entry.participants || entry.teamMembers),
      Discussion: getValue(entry.discussion || entry.topics),
      Decisions: getValue(entry.decisions || entry.plan),
      Provider: getValue(entry.provider)
    }));
  }
};
