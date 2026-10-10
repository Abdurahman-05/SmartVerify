import 'dotenv/config';

// Tests always use the separate test database, never the development one.
const testUrl = process.env['TEST_DATABASE_URL'];
if (!testUrl) throw new Error('TEST_DATABASE_URL is not set (see backend/.env.example)');

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = testUrl;
process.env['LOG_LEVEL'] = 'silent';
