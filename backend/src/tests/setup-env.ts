import { testDatabaseUrl } from './test-database.js';

// Tests always use the test schema, never the development data.
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = testDatabaseUrl().url;
process.env['LOG_LEVEL'] = 'silent';
