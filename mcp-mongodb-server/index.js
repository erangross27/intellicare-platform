#!/usr/bin/env node
/**
 * IntelliCare MongoDB MCP Server
 * Provides read AND write access to IntelliCare MongoDB databases:
 *   read:  list_databases, list_collections, find_documents, find_by_id,
 *          count_documents, aggregate, search_patients, get_patient_data
 *   write: insert_document, update_documents, delete_documents
 * Write tools require an explicit non-empty filter to prevent accidental
 * mass updates/deletes.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read MongoDB URI from .env file
function loadEnvFile() {
  const envPath = path.join(__dirname, '../apps/backend-api/.env');
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    for (const line of envContent.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !line.startsWith('#')) {
        env[match[1]] = match[2].trim();
      }
    }
    return env;
  } catch (error) {
    console.error('❌ Failed to read .env file:', error.message);
    process.exit(1);
  }
}

const env = loadEnvFile();
const MONGO_URI = env.MONGODB_ADMIN_URI || env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_ADMIN_URI or MONGODB_URI not found in .env');
  process.exit(1);
}

let mongoClient;
let adminDb;

// Initialize MongoDB connection
async function initMongo() {
  mongoClient = new MongoClient(MONGO_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000
  });
  await mongoClient.connect();
  adminDb = mongoClient.db('admin');
  
  // Test connection
  await adminDb.command({ ping: 1 });
  console.error('✅ Connected to MongoDB');
}

// Helper to safely convert string to ObjectId
function safeObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return id; // Return as-is if not valid ObjectId
  }
}

// If a filter targets _id with a hex string, coerce it to an ObjectId so the
// match works the way callers expect.
function normalizeFilterId(filter) {
  if (filter && typeof filter === 'object' && typeof filter._id === 'string') {
    return { ...filter, _id: safeObjectId(filter._id) };
  }
  return filter;
}

// Guard: write tools must never run with an empty/absent filter.
function requireNonEmptyFilter(filter, toolName) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter) || Object.keys(filter).length === 0) {
    throw new Error(`${toolName} requires a non-empty "filter" (refusing to run with an empty filter to avoid affecting every document)`);
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'intellicare-mongodb',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_databases',
        description: 'List all available databases in the MongoDB instance',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'list_collections',
        description: 'List all collections in a specific database',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name (e.g., intellicare_practice_global, intellicare_practice_yale)',
            },
          },
          required: ['database'],
        },
      },
      {
        name: 'find_documents',
        description: 'Find documents in a collection with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name',
            },
            collection: {
              type: 'string',
              description: 'Collection name',
            },
            filter: {
              type: 'object',
              description: 'MongoDB filter query (optional)',
              default: {},
            },
            limit: {
              type: 'number',
              description: 'Maximum number of documents to return (default: 10, max: 100)',
              default: 10,
            },
            sort: {
              type: 'object',
              description: 'Sort specification (optional, e.g., {createdAt: -1})',
            },
            projection: {
              type: 'object',
              description: 'Fields to include/exclude (optional, e.g., {name: 1, email: 1})',
            },
          },
          required: ['database', 'collection'],
        },
      },
      {
        name: 'count_documents',
        description: 'Count documents in a collection',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name',
            },
            collection: {
              type: 'string',
              description: 'Collection name',
            },
            filter: {
              type: 'object',
              description: 'MongoDB filter query (optional)',
              default: {},
            },
          },
          required: ['database', 'collection'],
        },
      },
      {
        name: 'find_by_id',
        description: 'Find a single document by its _id',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name',
            },
            collection: {
              type: 'string',
              description: 'Collection name',
            },
            id: {
              type: 'string',
              description: 'Document _id (string or ObjectId)',
            },
          },
          required: ['database', 'collection', 'id'],
        },
      },
      {
        name: 'aggregate',
        description: 'Run an aggregation pipeline on a collection',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name',
            },
            collection: {
              type: 'string',
              description: 'Collection name',
            },
            pipeline: {
              type: 'array',
              description: 'Aggregation pipeline stages',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of documents to return (default: 100)',
              default: 100,
            },
          },
          required: ['database', 'collection', 'pipeline'],
        },
      },
      {
        name: 'search_patients',
        description: 'Search for patients by name in any practice database',
        inputSchema: {
          type: 'object',
          properties: {
            practice: {
              type: 'string',
              description: 'Practice name (e.g., yale, global) or "all" to search all practices',
            },
            name: {
              type: 'string',
              description: 'Patient name to search for (first, last, or full name)',
            },
            limit: {
              type: 'number',
              description: 'Maximum results per practice (default: 10)',
              default: 10,
            },
          },
          required: ['practice', 'name'],
        },
      },
      {
        name: 'get_patient_data',
        description: 'Get all data for a specific patient across collections',
        inputSchema: {
          type: 'object',
          properties: {
            database: {
              type: 'string',
              description: 'Database name (e.g., intellicare_practice_yale)',
            },
            patientId: {
              type: 'string',
              description: 'Patient ID (string or ObjectId)',
            },
            collections: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific collections to query (optional, defaults to common medical collections)',
            },
          },
          required: ['database', 'patientId'],
        },
      },
      {
        name: 'insert_document',
        description: 'Insert a single document (use "document") or many documents (use "documents" array) into a collection',
        inputSchema: {
          type: 'object',
          properties: {
            database: { type: 'string', description: 'Database name' },
            collection: { type: 'string', description: 'Collection name' },
            document: { type: 'object', description: 'A single document to insert (insertOne)' },
            documents: { type: 'array', description: 'Multiple documents to insert (insertMany)' },
          },
          required: ['database', 'collection'],
        },
      },
      {
        name: 'update_documents',
        description: 'Update document(s) matching a filter. Requires a non-empty filter and an update object (e.g. { "$set": {...} }). Updates ONE by default; set many:true for updateMany.',
        inputSchema: {
          type: 'object',
          properties: {
            database: { type: 'string', description: 'Database name' },
            collection: { type: 'string', description: 'Collection name' },
            filter: { type: 'object', description: 'Non-empty MongoDB filter selecting the document(s) to update' },
            update: { type: 'object', description: 'Update operators, e.g. { "$set": { "status": "active" } }' },
            many: { type: 'boolean', description: 'Update all matches (updateMany). Default false (updateOne).', default: false },
            upsert: { type: 'boolean', description: 'Insert if no document matches. Default false.', default: false },
          },
          required: ['database', 'collection', 'filter', 'update'],
        },
      },
      {
        name: 'delete_documents',
        description: 'Delete document(s) matching a filter. Requires a non-empty filter (empty filter is refused to prevent mass deletion). Deletes ONE by default; set many:true for deleteMany.',
        inputSchema: {
          type: 'object',
          properties: {
            database: { type: 'string', description: 'Database name' },
            collection: { type: 'string', description: 'Collection name' },
            filter: { type: 'object', description: 'Non-empty MongoDB filter selecting the document(s) to delete' },
            many: { type: 'boolean', description: 'Delete all matches (deleteMany). Default false (deleteOne).', default: false },
          },
          required: ['database', 'collection', 'filter'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_databases': {
        const dbs = await mongoClient.db().admin().listDatabases();
        const intellicareDbs = dbs.databases
          .filter(db => db.name.startsWith('intellicare_'))
          .map(db => ({
            name: db.name,
            sizeOnDisk: db.sizeOnDisk,
            empty: db.empty
          }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              totalDatabases: intellicareDbs.length,
              databases: intellicareDbs.map(db => db.name)
            }, null, 2)
          }]
        };
      }

      case 'list_collections': {
        const { database } = args;
        const db = mongoClient.db(database);
        const collections = await db.listCollections().toArray();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database,
              collections: collections.map(col => col.name).sort()
            }, null, 2)
          }]
        };
      }

      case 'find_documents': {
        const { database, collection, filter = {}, limit = 10, sort, projection } = args;
        const db = mongoClient.db(database);
        const coll = db.collection(collection);
        
        let query = coll.find(filter);
        if (sort) query = query.sort(sort);
        if (projection) query = query.project(projection);
        
        const docs = await query.limit(Math.min(limit, 100)).toArray();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database,
              collection,
              filter,
              count: docs.length,
              documents: docs
            }, null, 2)
          }]
        };
      }

      case 'count_documents': {
        const { database, collection, filter = {} } = args;
        const db = mongoClient.db(database);
        const coll = db.collection(collection);
        const count = await coll.countDocuments(filter);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database,
              collection,
              filter,
              count
            }, null, 2)
          }]
        };
      }

      case 'find_by_id': {
        const { database, collection, id } = args;
        const db = mongoClient.db(database);
        const coll = db.collection(collection);
        const doc = await coll.findOne({ _id: safeObjectId(id) });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database,
              collection,
              id,
              found: !!doc,
              document: doc
            }, null, 2)
          }]
        };
      }

      case 'aggregate': {
        const { database, collection, pipeline, limit = 100 } = args;
        const db = mongoClient.db(database);
        const coll = db.collection(collection);
        
        // Add $limit stage if not present
        const hasLimit = pipeline.some(stage => stage.$limit);
        if (!hasLimit) {
          pipeline.push({ $limit: Math.min(limit, 100) });
        }
        
        const docs = await coll.aggregate(pipeline).toArray();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database,
              collection,
              count: docs.length,
              documents: docs
            }, null, 2)
          }]
        };
      }

      case 'search_patients': {
        const { practice, name, limit = 10 } = args;
        const searchRegex = new RegExp(name, 'i');
        
        let databases = [];
        if (practice === 'all') {
          const dbs = await mongoClient.db().admin().listDatabases();
          databases = dbs.databases
            .filter(db => db.name.startsWith('intellicare_practice_'))
            .map(db => db.name);
        } else {
          databases = [`intellicare_practice_${practice}`];
        }
        
        const results = [];
        for (const dbName of databases) {
          try {
            const db = mongoClient.db(dbName);
            const patients = await db.collection('patients').find({
              $or: [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { displayName: searchRegex }
              ]
            }).limit(limit).toArray();
            
            if (patients.length > 0) {
              results.push({
                database: dbName,
                patients: patients.map(p => ({
                  _id: p._id.toString(),
                  firstName: p.firstName,
                  lastName: p.lastName,
                  displayName: p.displayName,
                  dateOfBirth: p.dateOfBirth,
                  gender: p.gender
                }))
              });
            }
          } catch (err) {
            // Skip databases that don't exist or don't have patients collection
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              searchTerm: name,
              practicesSearched: databases.length,
              results
            }, null, 2)
          }]
        };
      }

      case 'get_patient_data': {
        const { database, patientId, collections } = args;
        const db = mongoClient.db(database);
        const patientObjId = safeObjectId(patientId);
        
        const targetCollections = collections || [
          'patients', 'medications', 'lab_results', 'vital_signs',
          'appointments', 'diagnoses', 'allergies', 'prescriptions'
        ];
        
        const results = {};
        for (const collName of targetCollections) {
          try {
            const coll = db.collection(collName);
            const docs = await coll.find({
              $or: [
                { patientId: patientObjId },
                { patientId: patientId },
                { _id: patientObjId }
              ]
            }).limit(50).toArray();
            
            if (docs.length > 0) {
              results[collName] = docs;
            }
          } catch (err) {
            // Collection might not exist
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database,
              patientId,
              collectionsFound: Object.keys(results),
              data: results
            }, null, 2)
          }]
        };
      }

      case 'insert_document': {
        const { database, collection, document, documents } = args;
        const coll = mongoClient.db(database).collection(collection);
        if (Array.isArray(documents)) {
          const result = await coll.insertMany(documents);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ database, collection, acknowledged: result.acknowledged, insertedCount: result.insertedCount, insertedIds: result.insertedIds }, null, 2)
            }]
          };
        }
        if (!document || typeof document !== 'object' || Array.isArray(document)) {
          throw new Error('insert_document requires "document" (object) or "documents" (array)');
        }
        const result = await coll.insertOne(document);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ database, collection, acknowledged: result.acknowledged, insertedId: result.insertedId }, null, 2)
          }]
        };
      }

      case 'update_documents': {
        const { database, collection, filter, update, many = false, upsert = false } = args;
        requireNonEmptyFilter(filter, 'update_documents');
        if (!update || typeof update !== 'object' || Object.keys(update).length === 0) {
          throw new Error('update_documents requires an "update" object, e.g. { "$set": { ... } }');
        }
        const normalizedFilter = normalizeFilterId(filter);
        const coll = mongoClient.db(database).collection(collection);
        const result = many
          ? await coll.updateMany(normalizedFilter, update, { upsert })
          : await coll.updateOne(normalizedFilter, update, { upsert });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ database, collection, filter: normalizedFilter, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount, upsertedId: result.upsertedId }, null, 2)
          }]
        };
      }

      case 'delete_documents': {
        const { database, collection, filter, many = false } = args;
        requireNonEmptyFilter(filter, 'delete_documents');
        const normalizedFilter = normalizeFilterId(filter);
        const coll = mongoClient.db(database).collection(collection);
        const result = many
          ? await coll.deleteMany(normalizedFilter)
          : await coll.deleteOne(normalizedFilter);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ database, collection, filter: normalizedFilter, deletedCount: result.deletedCount }, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          tool: name,
          args
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  await initMongo();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('🚀 IntelliCare MongoDB MCP Server running on stdio');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n🛑 Shutting down...');
  await mongoClient.close();
  process.exit(0);
});
