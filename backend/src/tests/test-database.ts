import 'dotenv/config';

/**
 * The test database URL. Tests empty tables, so this refuses anything that is not clearly a test
 * schema: the URL must set `?schema=` to a name containing "test" (never `public`).
 */
export function testDatabaseUrl() {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see backend/README.md)');
  const schema = new URL(url).searchParams.get('schema');
  if (!schema || !/test/i.test(schema)) {
    throw new Error(
      'TEST_DATABASE_URL must set ?schema= to a test schema (name containing "test")'
    );
  }
  return { url, schema };
}
