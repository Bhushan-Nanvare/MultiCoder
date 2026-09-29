-- Rooms gain a mode, fixed when the room is created:
--   collaborate = team project (AI review for everyone, no plagiarism check)
--   assessment  = someone is being judged (both tools belong to the room owner)
-- Additive only: existing rows and any older build still running default to
-- 'collaborate', which is exactly today's behaviour.

CREATE TYPE "RoomMode" AS ENUM ('collaborate', 'assessment');

ALTER TABLE "rooms" ADD COLUMN "mode" "RoomMode" NOT NULL DEFAULT 'collaborate';
