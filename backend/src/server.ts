import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { deleteOldChecks } from './modules/verification/record-check.js';
import { sendScheduledNotifications } from './services/notifications.js';

const env = loadEnv();
const app = await buildApp({ env });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`API docs: http://localhost:${env.PORT}/docs`);

  // Every day: verified and failed checks older than 4 months are deleted.
  const cleanUp = async () => {
    try {
      app.log.info(await deleteOldChecks(app.prisma), 'deleted old checks');
    } catch (error) {
      app.log.error(error, 'could not delete old checks');
    }
  };
  void cleanUp();
  setInterval(() => void cleanUp(), 24 * 3_600_000).unref();

  // Every hour: the evening summary and the owner's plan reminders (each sent once).
  const remind = async () => {
    try {
      await sendScheduledNotifications(app.prisma, app.log);
    } catch (error) {
      app.log.error(error, 'could not send scheduled notifications');
    }
  };
  void remind();
  setInterval(() => void remind(), 3_600_000).unref();
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
