module.exports = {
  title: '🤱 Postpartum Planning',
  columns: ['Date', 'Feeding Plan', 'Contraception', 'Follow-up', 'Provider'],
  mapper: (categoryData) => {
    const getValue = (val, defaultVal = '-') => {
      if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      return String(val).trim() || defaultVal;
    };
    return categoryData.map(entry => ({
      Date: entry.date ? new Date(entry.date).toLocaleDateString() : '-',
      'Feeding Plan': getValue(entry.feedingPlan || entry.feeding),
      Contraception: getValue(entry.contraception || entry.birthControl),
      'Follow-up': getValue(entry.followUp || entry.postpartumVisit),
      Provider: getValue(entry.provider)
    }));
  }
};
