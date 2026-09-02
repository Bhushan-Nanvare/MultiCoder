-- CreateEnum
CREATE TYPE "RoomVisibility" AS ENUM ('private', 'link_edit', 'link_view');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "visibility" "RoomVisibility" NOT NULL DEFAULT 'link_edit';
