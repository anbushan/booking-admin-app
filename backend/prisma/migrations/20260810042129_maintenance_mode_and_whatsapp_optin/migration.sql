-- AlterTable
ALTER TABLE "AppConfig" ADD COLUMN     "maintenanceMessage" TEXT,
ADD COLUMN     "maintenanceMode" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;
