const mongoose = require('mongoose');
const databaseFactory = require('./utils/databaseFactory');
const User = require('./models/User');

async function fixUser() {
  try {
    console.log('🔧 Fixing user for passwordless login...');

    const practiceSubdomain = 'developer';
    const practiceDb = await databaseFactory.getClinicDatabase(practiceSubdomain);
    const UserModel = User.createModel(practiceDb);

    // Find your actual user
    const email = 'erangross27@gmail.com';
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 Found user:', user.email);
    console.log('📧 Email verified before:', user.emailVerified);

    // Enable email verification
    user.emailVerified = true;
    await user.save();
    
    console.log('✅ Email verification enabled!');
    console.log('📧 Email verified now:', user.emailVerified);
    console.log('\n🎉 Now use erangross27@gmail.com in the login form!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixUser();
