const databaseFactory = require('./utils/databaseFactory');
const mongoose = require('mongoose');

async function fixUserRoles() {
  try {
    console.log('🔧 Fixing user roles - removing redundant doctor role...');
    
    // Initialize database
    await databaseFactory.initialize();
    const practiceDb = await databaseFactory.getClinicDatabase('developer');

    // Create User schema
    const userSchema = new mongoose.Schema({
      email: String,
      passwordHash: String,
      roles: [String],
      permissions: [String],
      profile: {
        firstName: String,
        lastName: String,
        title: String
      },
      status: String,
      updatedAt: Date,
      updatedBy: String
    });

    const UserModel = practiceDb.model('User', userSchema);

    // Find the user
    const user = await UserModel.findOne({ email: 'eran@gross.support' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 Current user roles:', user.roles);
    console.log('🔑 Current permissions count:', user.permissions?.length || 0);

    // Remove doctor role if present, keep only admin
    if (user.roles.includes('doctor') && user.roles.includes('admin')) {
      console.log('🔧 Removing redundant doctor role...');
      
      user.roles = ['admin']; // Keep only admin role
      
      // Recompute permissions for admin role only
      const { getEffectivePermissions } = require('./rbac/rbacService');
      const derivedPermissions = await getEffectivePermissions({ 
        practiceDb: practiceDb, 
        roles: ['admin'] 
      });
      
      user.permissions = derivedPermissions;
      user.updatedAt = new Date();
      user.updatedBy = 'system-fix';

      await user.save();

      console.log('✅ User roles updated successfully');
      console.log('👤 New roles:', user.roles);
      console.log('🔑 New permissions count:', user.permissions.length);
      console.log('📋 New permissions:', user.permissions);
      
      // Check if write_documents is included
      const hasWriteDocuments = user.permissions.includes('write_documents');
      console.log('📄 Has write_documents permission:', hasWriteDocuments);
      
    } else {
      console.log('ℹ️ User roles are already correct');
    }

  } catch (error) {
    console.error('❌ Error fixing user roles:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
}

// Run the fix
fixUserRoles();
