const mongoose = require('mongoose');
const ChatSession = require('./models/ChatSession');

async function checkChatSessions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/intellicare');
    console.log('Connected to MongoDB');
    
    // Count all sessions
    const totalSessions = await ChatSession.countDocuments({ userId: 'default-doctor-user' });
    console.log('Total sessions in database:', totalSessions);
    
    // Count active sessions
    const activeSessions = await ChatSession.countDocuments({ userId: 'default-doctor-user', isActive: true });
    console.log('Active sessions in database:', activeSessions);
    
    // Count inactive sessions
    const inactiveSessions = await ChatSession.countDocuments({ userId: 'default-doctor-user', isActive: false });
    console.log('Inactive sessions in database:', inactiveSessions);
    
    // Show recent sessions with their status
    const recentSessions = await ChatSession.find({ userId: 'default-doctor-user' })
      .sort({ lastMessageAt: -1 })
      .limit(15)
      .select('sessionId title isActive lastMessageAt');
    
    console.log('\nRecent sessions:');
    recentSessions.forEach(session => {
      const status = session.isActive ? 'ACTIVE' : 'INACTIVE';
      console.log(`- ${session.sessionId}: "${session.title}" (${status})`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
}

checkChatSessions();
