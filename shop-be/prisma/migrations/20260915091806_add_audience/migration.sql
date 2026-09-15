-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('MEN', 'WOMEN', 'KIDS', 'UNISEX');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "audience" "Audience" NOT NULL DEFAULT 'UNISEX';
