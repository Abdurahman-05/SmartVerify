-- Account numbers differ in length by bank (Abyssinia 8–9 digits, CBE 13, some banks 16).
ALTER TABLE "BankAccount" DROP CONSTRAINT "BankAccount_number_format";
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_number_format" CHECK ("accountNumber" ~ '^[0-9]{8,16}$');
