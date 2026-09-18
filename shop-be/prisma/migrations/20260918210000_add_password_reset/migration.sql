-- "Quen mat khau" — luu hash cua token (khong luu token goc) + han dung.
ALTER TABLE "User" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);
