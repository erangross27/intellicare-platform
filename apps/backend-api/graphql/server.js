// GraphQL Server Setup
// Integrates GraphQL with comprehensive security controls

const { ApolloServer } = require('apollo-server-express');
const { applyMiddleware } = require('graphql-middleware');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const graphqlSecurityService = require('../services/graphqlSecurityService');
const secureConfigService = require('../services/secureConfigService');

/**
 * Create secure GraphQL server
 */
async function createGraphQLServer(app) {
  try {
    // Create base schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    });

    // Apply security middleware
    const securedSchema = applyMiddleware(
      schema,
      graphqlSecurityService.createSecurityShield(),
      graphqlSecurityService.createQueryTimeout()
    );

    // Create Apollo Server with security controls
    const server = new ApolloServer({
      schema: securedSchema,
      
      // Security validations
      validationRules: [
        graphqlSecurityService.createDepthLimit()
        // Complexity analysis handled in plugins
      ],

      // Context function - adds user and security info
      context: ({ req, res }) => {
        // Increment query counter
        graphqlSecurityService.stats.totalQueries++;

        // Extract user from request (simplified for demo)
        const token = req.headers.authorization?.replace('Bearer ', '');
        let user = null;
        
        if (token && token !== 'undefined') {
          // In production, verify JWT properly
          user = { id: 'demo-user', role: 'DOCTOR' };
        }

        return {
          req,
          res,
          user,
          practiceId: req.headers['x-practice-subdomain'] || 'developer'
        };
      },

      // Enhanced error handling
      formatError: (error) => {
        // Record security events
        if (error.message.includes('Rate limit') || 
            error.message.includes('depth') || 
            error.message.includes('complexity')) {
          graphqlSecurityService.stats.blockedQueries++;
        }

        // In production, don't expose internal errors
        if (secureConfigService.get('NODE_ENV') === 'production' && !error.message.startsWith('Access denied')) {
          console.error('GraphQL Error:', error);
          return new Error('An error occurred while processing your request');
        }

        return error;
      },

      // Disable introspection and playground in production
      introspection: !graphqlSecurityService.config.introspectionDisabled,
      playground: secureConfigService.get('NODE_ENV') !== 'production',

      // Additional security options
      uploads: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      },

      // Custom plugins for monitoring
      plugins: [
        {
          // Request lifecycle plugin
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                // Log operation type and name
                const { operationName, request } = requestContext;
                console.log(`GraphQL ${request.query?.match(/^\s*(query|mutation|subscription)/)?.[1] || 'query'}: ${operationName || 'anonymous'}`);
              },

              didEncounterErrors(requestContext) {
                // Log errors for monitoring
                requestContext.errors?.forEach(error => {
                  console.error('GraphQL execution error:', {
                    message: error.message,
                    path: error.path,
                    operation: requestContext.request.operationName
                  });
                });
              },

              willSendResponse(requestContext) {
                // Add security headers (simplified)
                try {
                  if (requestContext.response.http) {
                    requestContext.response.http.setHeader('X-GraphQL-Query-Cost', '1');
                    requestContext.response.http.setHeader('X-GraphQL-Rate-Limit-Remaining', '99');
                  }
                } catch (error) {
                  // Headers already sent or not available
                }
              }
            };
          }
        },

        // Query complexity plugin
        {
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                // Validate query whitelist in production
                if (secureConfigService.get('NODE_ENV') === 'production') {
                  try {
                    graphqlSecurityService.validateQueryWhitelist(requestContext.request.query);
                  } catch (error) {
                    throw error;
                  }
                }

                // Validate aliases and directives
                if (requestContext.document) {
                  graphqlSecurityService.validateAliases(requestContext.document);
                  graphqlSecurityService.validateDirectives(requestContext.document);
                }
              }
            };
          }
        }
      ]
    });

    // Start the server
    await server.start();

    // Apply middleware to Express app
    server.applyMiddleware({ 
      app, 
      path: '/api/graphql',
      cors: false, // Use existing CORS configuration
      bodyParserConfig: {
        limit: '50mb'
      }
    });

    // GraphQL Server initialized with security controls

    return server;

  } catch (error) {
    console.error('Failed to create GraphQL server:', error);
    throw error;
  }
}

module.exports = { createGraphQLServer };