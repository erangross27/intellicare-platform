module.exports = {
  title: '🏥 Available Medical Categories',
  columns: ['Category', 'Collection Name'],
  mapper: (entry) => ({
    'Category': entry.displayName || entry.name || 'Unknown',
    'Collection Name': entry.name || '-'
  })
};
