/**
 * Compliance Security Feature Auth - Library Exports
 * DDD/NX Architecture Export Index
 */

// Export GraphQL Security Service
const GraphQLSecurityService = require('./src/lib/graphql-security-service');

// Export all auth-related services
module.exports = {
  GraphQLSecurityService,
  
  // Re-export with legacy name for compatibility
  graphqlSecurityService: GraphQLSecurityService
};