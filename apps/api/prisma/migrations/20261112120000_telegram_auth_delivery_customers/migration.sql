-- Telegram-based staff authentication, delivery role and registered customers.

-- Add DELIVERY to the role enum (PostgreSQL 12+ allows this inside the migration transaction).
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DELIVERY';

-- Staff Telegram identity fields.
ALTER TABLE "User"
  ADD COLUMN "telegramId" TEXT,
  ADD COLUMN "telegramUsername" TEXT,
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- Registered customers for remote (delivery) orders.
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_telegramId_key" ON "Customer"("telegramId");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- Order -> registered customer (null for staff-created orders).
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;

CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
