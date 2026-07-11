/**
 * AccessHelpers - Extracted helper functions from agentServiceV4
 * Auto-generated on 2025-10-06T13:43:17.481Z
 */

class AccessHelpers {

    getAccessChanges(oldRole, newRole, practiceContext) {
      const isHebrew = practiceContext.language === 'he';
      const oldPerms = this.generateRolePermissions(oldRole);
      const newPerms = this.generateRolePermissions(newRole);
      
      const changes = {
        added: [],
        removed: [],
        modified: []
      };
      
      // Find added permissions
      Object.keys(newPerms).forEach(resource => {
        if (!oldPerms[resource]) {
          changes.added.push(resource);
        }
      });
      
      // Find removed permissions
      Object.keys(oldPerms).forEach(resource => {
        if (!newPerms[resource]) {
          changes.removed.push(resource);
        }
      });
      
      return {
        hasChanges: changes.added.length > 0 || changes.removed.length > 0,
        summary: isHebrew 
          ? `נוספו ${changes.added.length} הרשאות, הוסרו ${changes.removed.length} הרשאות`
          : `${changes.added.length} permissions added, ${changes.removed.length} permissions removed`,
        changes: changes
      };
    }
}

module.exports = AccessHelpers;
