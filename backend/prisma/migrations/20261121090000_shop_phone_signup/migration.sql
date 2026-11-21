-- AlterTable: additive only (defaults fill the live rows); nothing is dropped or changed.
ALTER TABLE "User" ADD COLUMN     "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinLockedUntil" TIMESTAMP(3);
