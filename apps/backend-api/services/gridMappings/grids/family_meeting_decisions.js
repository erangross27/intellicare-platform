module.exports = {
  title: '👨‍👩‍👧 Family Meeting Decisions',
  columns: ['Date', 'Attendees', 'Topics', 'Decisions', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      Attendees: getValue(entry.attendees || entry.participants),
      Topics: getValue(entry.topics || entry.discussion),
      Decisions: getValue(entry.decisions || entry.outcomes),
      Provider: getValue(entry.provider)
    }));
  }
};
