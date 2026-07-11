/**
 * UserHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class UserHelpers {

    generateRolePermissions(role) {
      const permissions = {
        admin: {
          patients: ['create', 'read', 'update', 'delete'],
          users: ['create', 'read', 'update', 'delete'],
          reports: ['create', 'read', 'export'],
          system: ['backup', 'restore', 'configure'],
          billing: ['read', 'update'],
          audit: ['read', 'export']
        },
        doctor: {
          patients: ['create', 'read', 'update'],
          medical_data: ['create', 'read', 'update'],
          prescriptions: ['create', 'read', 'update'],
          reports: ['create', 'read'],
          consultations: ['create', 'read', 'update']
        },
        nurse: {
          patients: ['read', 'update'],
          medical_data: ['create', 'read', 'update'],
          vital_signs: ['create', 'read', 'update'],
          medications: ['read', 'update'],
          reports: ['read']
        },
        receptionist: {
          patients: ['create', 'read', 'update'],
          appointments: ['create', 'read', 'update', 'delete'],
          billing: ['read', 'update'],
          reports: ['read']
        },
        technician: {
          patients: ['read'],
          lab_results: ['create', 'read', 'update'],
          imaging: ['create', 'read', 'update'],
          reports: ['read']
        }
      };
  
      return permissions[role] || permissions.receptionist;
    }

    generateWelcomeMessage(userData, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return {
        subject: isHebrew ? 'ברוכים הבאים למערכת IntelliCare' : 'Welcome to IntelliCare System',
        body: isHebrew 
          ? `שלום ${userData.firstName},\n\nחשבון המשתמש שלך נוצר בהצלחה.\n\nפרטי החשבון:\n- תפקיד: ${userData.role}\n- אימייל: ${userData.email}\n\nיש לך 24 שעות לעדכן את הסיסמה הראשונית.\n\nצוות IntelliCare`
          : `Hello ${userData.firstName},\n\nYour user account has been created successfully.\n\nAccount Details:\n- Role: ${userData.role}\n- Email: ${userData.email}\n\nYou have 24 hours to update your initial password.\n\nIntelliCare Team`,
        nextSteps: isHebrew 
          ? ['התחבר למערכת', 'עדכן סיסמה', 'השלם פרופיל']
          : ['Login to system', 'Update password', 'Complete profile']
      };
    }

    generateUserSummary(userData, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return {
        name: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
        role: userData.role,
        department: userData.department || (isHebrew ? 'לא צוין' : 'Not specified'),
        status: userData.status,
        permissions: Object.keys(userData.permissions).length,
        created: userData.createdAt,
        mustChangePassword: userData.mustChangePassword
      };
    }

    generateUserNextSteps(userData, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      const steps = [
        {
          step: 1,
          action: isHebrew ? 'שלח אימייל הזמנה' : 'Send invitation email',
          description: isHebrew 
            ? 'שלח לאימייל הוראות התחברות ראשונית'
            : 'Send initial login instructions to email'
        },
        {
          step: 2,
          action: isHebrew ? 'אמת זהות' : 'Verify identity',
          description: isHebrew 
            ? 'וודא שהמשתמש אימת את כתובת האימייל'
            : 'Ensure user verifies email address'
        },
        {
          step: 3,
          action: isHebrew ? 'הדרכה ראשונית' : 'Initial training',
          description: isHebrew 
            ? 'ספק הדרכה על המערכת והפונקציות'
            : 'Provide system and function training'
        }
      ];
  
      if (userData.role === 'doctor' || userData.role === 'nurse') {
        steps.push({
          step: 4,
          action: isHebrew ? 'אישורי רישוי' : 'License verification',
          description: isHebrew 
            ? 'אמת רישיונות והסמכות רפואיות'
            : 'Verify medical licenses and certifications'
        });
      }
  
      return steps;
    }

    generateCreateUserMessage(userData, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return isHebrew 
        ? `המשתמש ${userData.profile.firstName} ${userData.profile.lastName} (${userData.roles[0]}) נוצר בהצלחה. נשלח אימייל לאימות כתובת האימייל ${userData.email}. המשתמש יוכל להתחבר רק לאחר אימות האימייל.`
        : `User ${userData.profile.firstName} ${userData.profile.lastName} (${userData.roles[0]}) created successfully. Verification email sent to ${userData.email}. User can only login after email verification.`;
    }

    generateRoleChangeSummary(currentUser, newRole, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return {
        user: `${currentUser.firstName} ${currentUser.lastName}`,
        previousRole: currentUser.role,
        newRole: newRole,
        changedAt: new Date().toISOString(),
        summary: isHebrew 
          ? `תפקיד השתנה מ-${currentUser.role} ל-${newRole}`
          : `Role changed from ${currentUser.role} to ${newRole}`,
        requiresTraining: this.doesRoleChangeRequireTraining(currentUser.role, newRole),
        accessChanged: this.getAccessChanges(currentUser.role, newRole, practiceContext)
      };
    }

    generateRoleUpdateMessage(currentUser, newRole, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      
      return isHebrew 
        ? `תפקיד ${currentUser.firstName} ${currentUser.lastName} עודכן ל-${newRole}`
        : `${currentUser.firstName} ${currentUser.lastName}'s role updated to ${newRole}`;
    }

    comparePermissions(oldPermissions, newPermissions) {
      return JSON.stringify(oldPermissions) === JSON.stringify(newPermissions);
    }

    doesRoleChangeRequireTraining(oldRole, newRole) {
      const significantChanges = [
        ['receptionist', 'nurse'],
        ['nurse', 'doctor'],
        ['technician', 'nurse'],
        ['any', 'admin']
      ];
      
      return significantChanges.some(([from, to]) => 
        (from === 'any' || from === oldRole) && to === newRole
      );
    }
}

module.exports = UserHelpers;
