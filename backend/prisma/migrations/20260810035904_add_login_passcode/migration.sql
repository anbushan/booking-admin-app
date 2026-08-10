-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passcodeCreatedAt" TIMESTAMP(3),
ADD COLUMN     "passcodeHash" TEXT;
