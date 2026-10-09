import 'dotenv/config';

// Tests always use the separate test database, never the development one.
const testUrl = process.env['TEST_DATABASE_URL'];
if (!testUrl) throw new Error('TEST_DATABASE_URL is not set (see backend/.env.example)');

process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = testUrl;
process.env['LOG_LEVEL'] = 'silent';
process.env['ALLOW_UNPAID_SUBSCRIPTIONS'] = 'true';
process.env['SIGN_IN_MAX_ATTEMPTS'] = process.env['SIGN_IN_MAX_ATTEMPTS_TEST'] ?? '100';
process.env['REGISTER_MAX_PER_HOUR'] = '10000';
process.env['JWT_SECRET'] ??= 'test-secret-that-is-long-enough-for-hs256-signing';
