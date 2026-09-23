-- The app's snapshot table already owned the name `snapshots`, which
-- sharedb-postgres requires for its own storage, so the earlier
-- `CREATE TABLE IF NOT EXISTS snapshots` silently did nothing and ShareDB
-- persistence never worked. Move the app table out of the way, then create the
-- two tables sharedb-postgres expects (`ops` was dropped by the previous
-- migration, because it wasn't declared in schema.prisma).

ALTER TABLE "snapshots" RENAME TO "room_snapshots";
ALTER TABLE "room_snapshots" RENAME CONSTRAINT "snapshots_pkey" TO "room_snapshots_pkey";
ALTER TABLE "room_snapshots" RENAME CONSTRAINT "snapshots_roomId_fkey" TO "room_snapshots_roomId_fkey";
ALTER TABLE "room_snapshots" RENAME CONSTRAINT "snapshots_createdBy_fkey" TO "room_snapshots_createdBy_fkey";
ALTER INDEX "snapshots_roomId_createdAt_idx" RENAME TO "room_snapshots_roomId_createdAt_idx";

CREATE TABLE "ops" (
    "collection" VARCHAR(255) NOT NULL,
    "doc_id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "operation" JSONB NOT NULL,

    CONSTRAINT "ops_pkey" PRIMARY KEY ("collection", "doc_id", "version")
);

CREATE TABLE "snapshots" (
    "collection" VARCHAR(255) NOT NULL,
    "doc_id" VARCHAR(255) NOT NULL,
    "version" INTEGER NOT NULL,
    "doc_type" VARCHAR(255) NOT NULL,
    "data" JSONB NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("collection", "doc_id")
);
