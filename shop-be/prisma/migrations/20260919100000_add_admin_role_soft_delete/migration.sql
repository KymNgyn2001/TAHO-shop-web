-- Role ADMIN + xoa mem (deletedAt) cho tai khoan va san pham.
ALTER TYPE "Role" ADD VALUE 'ADMIN';
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "deletedAt" TIMESTAMP(3);
