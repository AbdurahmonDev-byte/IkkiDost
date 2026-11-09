-- DropIndex
DROP INDEX "RoomSession_roomId_idx";

-- DropIndex
DROP INDEX "RoomSession_roomId_status_key";

-- CreateIndex
CREATE INDEX "RoomSession_roomId_status_idx" ON "RoomSession"("roomId", "status");
