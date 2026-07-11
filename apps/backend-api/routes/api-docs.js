/**
 * API Documentation Routes
 * Serves OpenAPI/Swagger documentation for external healthcare APIs
 * with interactive UI and downloadable specifications.
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const router = express.Router();

// Load OpenAPI specification
let openApiSpec;
try {
  const specPath = path.join(__dirname, '../docs/api/external-api.yaml');
  openApiSpec = YAML.load(specPath);
} catch (error) {
  console.error('Failed to load OpenAPI specification:', error);
  openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'IntelliCare External API',
      version: '1.0.0',
      description: 'API specification could not be loaded'
    },
    paths: {}
  };
}

// Swagger UI configuration
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    url: '/api/docs/spec.json',
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true,
    requestInterceptor: (req) => {
      // Add authentication header automatically if available
      const token = localStorage.getItem('authToken');
      if (token) {
        req.headers['Authorization'] = `Bearer ${token}`;
      }
      return req;
    }
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #1976d2; }
    .swagger-ui .scheme-container { 
      background: #f5f5f5; 
      padding: 10px; 
      border-radius: 4px; 
      margin: 10px 0; 
    }
    .swagger-ui .btn.execute { background-color: #1976d2; }
    .swagger-ui .btn.execute:hover { background-color: #1565c0; }
    .swagger-ui .response.col_12 { margin-top: 10px; }
    .swagger-ui .opblock-tag { 
      font-size: 18px; 
      font-weight: bold; 
      color: #333; 
    }
    .swagger-ui .opblock.opblock-get .opblock-summary-method { 
      background: #61affe; 
    }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { 
      background: #49cc90; 
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method { 
      background: #f93e3e; 
    }
  `,
  customSiteTitle: 'IntelliCare External API Documentation',
  customfavIcon: '/favicon.ico'
};

/**
 * @route GET /api/docs
 * @desc Serve Swagger UI for API documentation
 * @access Public
 */
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, swaggerOptions));

/**
 * @route GET /api/docs/spec.json
 * @desc Get OpenAPI specification as JSON
 * @access Public
 */
router.get('/spec.json', (req, res) => {
  res.json(openApiSpec);
});

/**
 * @route GET /api/docs/spec.yaml
 * @desc Get OpenAPI specification as YAML
 * @access Public
 */
router.get('/spec.yaml', async (req, res) => {
  try {
    const specPath = path.join(__dirname, '../docs/api/external-api.yaml');
    const yamlContent = await fs.readFile(specPath, 'utf8');
    res.set('Content-Type', 'text/yaml');
    res.send(yamlContent);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to load YAML specification',
      message: error.message 
    });
  }
});

/**
 * @route GET /api/docs/postman
 * @desc Generate Postman collection from OpenAPI spec
 * @access Public
 */
router.get('/postman', (req, res) => {
  try {
    // Convert OpenAPI to Postman collection format
    const postmanCollection = {
      info: {
        name: openApiSpec.info.title,
        description: openApiSpec.info.description,
        version: openApiSpec.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{authToken}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'baseUrl',
          value: 'https://intellicare.health/api',
          type: 'string'
        },
        {
          key: 'authToken',
          value: '',
          type: 'string'
        }
      ],
      item: []
    };

    // Convert paths to Postman requests
    Object.entries(openApiSpec.paths || {}).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, operation]) => {
        if (method === 'parameters') return; // Skip path-level parameters

        const request = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
                type: 'text'
              }
            ],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(p => p)
            },
            description: operation.description
          }
        };

        // Add request body for POST/PUT methods
        if (operation.requestBody) {
          const schema = operation.requestBody.content?.['application/json']?.schema;
          if (schema?.example) {
            request.request.body = {
              mode: 'raw',
              raw: JSON.stringify(schema.example, null, 2),
              options: {
                raw: {
                  language: 'json'
                }
              }
            };
          }
        }

        // Add query parameters
        if (operation.parameters) {
          const queryParams = operation.parameters
            .filter(p => p.in === 'query')
            .map(p => ({
              key: p.name,
              value: p.example || (p.schema?.example) || '',
              description: p.description,
              disabled: !p.required
            }));
          
          if (queryParams.length > 0) {
            request.request.url.query = queryParams;
          }
        }

        // Group by tags
        const tag = operation.tags?.[0] || 'General';
        let folder = postmanCollection.item.find(item => item.name === tag);
        if (!folder) {
          folder = {
            name: tag,
            description: `API endpoints for ${tag}`,
            item: []
          };
          postmanCollection.item.push(folder);
        }
        
        folder.item.push(request);
      });
    });

    res.json(postmanCollection);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate Postman collection',
      message: error.message
    });
  }
});

/**
 * @route GET /api/docs/health
 * @desc API documentation health check
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    documentation: {
      available: !!openApiSpec,
      endpoints: Object.keys(openApiSpec.paths || {}).length,
      version: openApiSpec.info?.version,
      lastUpdated: new Date().toISOString()
    },
    ui: {
      swaggerUI: 'available',
      formats: ['json', 'yaml'],
      exports: ['postman']
    }
  });
});

/**
 * @route GET /api/docs/stats
 * @desc Get API documentation statistics
 * @access Public
 */
router.get('/stats', (req, res) => {
  try {
    const stats = {
      totalEndpoints: 0,
      methodBreakdown: {},
      tagBreakdown: {},
      securitySchemes: Object.keys(openApiSpec.components?.securitySchemes || {}),
      schemas: Object.keys(openApiSpec.components?.schemas || {}).length
    };

    // Count endpoints and analyze methods/tags
    Object.entries(openApiSpec.paths || {}).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, operation]) => {
        if (method === 'parameters') return;
        
        stats.totalEndpoints++;
        stats.methodBreakdown[method.toUpperCase()] = 
          (stats.methodBreakdown[method.toUpperCase()] || 0) + 1;
        
        if (operation.tags) {
          operation.tags.forEach(tag => {
            stats.tagBreakdown[tag] = (stats.tagBreakdown[tag] || 0) + 1;
          });
        }
      });
    });

    res.json({
      success: true,
      data: stats,
      generated: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate documentation statistics',
      message: error.message
    });
  }
});

module.exports = router;