-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "deliveryAddress" TEXT;

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "cashCollectedAmount" INTEGER,
ADD COLUMN     "cashCollectedAt" TIMESTAMP(3),
ADD COLUMN     "cashHandedOverAt" TIMESTAMP(3);
