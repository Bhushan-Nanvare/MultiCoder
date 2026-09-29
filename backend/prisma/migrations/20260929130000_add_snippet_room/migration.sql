-- A plagiarism submission now belongs to one assessment room, so re-checking
-- replaces it instead of piling up copies, and only submissions from other
-- rooms are ever compared. Additive: existing snippets keep roomId NULL and
-- drop out of comparisons.

ALTER TABLE "snippets" ADD COLUMN "roomId" TEXT;

CREATE UNIQUE INDEX "snippets_roomId_key" ON "snippets"("roomId");

ALTER TABLE "snippets" ADD CONSTRAINT "snippets_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
