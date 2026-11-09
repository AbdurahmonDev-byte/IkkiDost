-- Add a separately snapshotted flat delivery fee.
ALTER TABLE "Order"
ADD COLUMN "deliveryFeeAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ServiceFeeConfig"
ADD COLUMN "deliveryFeeAmount" INTEGER NOT NULL DEFAULT 5000;
