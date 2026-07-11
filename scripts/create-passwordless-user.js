const mongoose = require('mongoose');
const databaseFactory = require('./utils/databaseFactory');
const User = require('./models/User');

async function createPasswordlessUser() {
  try {
    console.log('🔗 Creating passwordless user...');

    // Connect to practice database
    const practiceSubdomain = 'developer';
    const practiceDb = await databaseFactory.getClinicDatabase(practiceSubdomain);
    const UserModel = User.createModel(practiceDb);

    // User details
    const email = 'eran@gross.support';
    
    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('👤 User already exists, updating to passwordless...');
      
      // Update existing user to be passwordless
      existingUser.emailVerified = true;
      existingUser.status = 'active';
      // Remove password field if it exists
      if (existingUser.passwordHash) {
        existingUser.passwordHash = undefined;
      }
      await existingUser.save();
      
      console.log('✅ Updated existing user to passwordless');
      console.log(`📧 Email: ${existingUser.email}`);
      console.log(`👤 Name: ${existingUser.fullName}`);
      console.log(`🔐 Email Verified: ${existingUser.emailVerified}`);
      console.log(`📊 Status: ${existingUser.status}`);
      console.log(`🎭 Roles: ${existingUser.roles.join(', ')}`);
    } else {
      // Create new passwordless user
      const newUser = new UserModel({
        email: email.toLowerCase(),
        profile: {
          firstName: 'Eran',
          lastName: 'Gross',
          title: 'Dr.',
          phone: ''
        },
        emailVerified: true, // Already verified
        roles: ['admin', 'doctor'], // Give admin access
        permissions: [
          'read_patients', 'write_patients', 'delete_patients',
          'read_documents', 'write_documents', 'delete_documents',
          'manage_users', 'view_reports', 'system_admin'
        ],
        status: 'active',
        preferredLanguage: 'he',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newUser.save();
      
      console.log('✅ Created new passwordless user');
      console.log(`📧 Email: ${newUser.email}`);
      console.log(`👤 Name: ${newUser.fullName}`);
      console.log(`🔐 Email Verified: ${newUser.emailVerified}`);
      console.log(`📊 Status: ${newUser.status}`);
      console.log(`🎭 Roles: ${newUser.roles.join(', ')}`);
    }

    console.log('\n🎉 Passwordless user ready!');
    console.log('Now you can use the magic login link system.');
    
  } catch (error) {
    console.error('❌ Error creating passwordless user:', error);
  } finally {
    // Close database connections
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run the script
createPasswordlessUser();
