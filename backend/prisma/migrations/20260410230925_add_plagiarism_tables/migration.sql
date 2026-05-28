-- CreateTable
CREATE TABLE "snippets" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fingerprintCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snippets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fingerprints" (
    "id" BIGSERIAL NOT NULL,
    "snippetId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "fingerprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snippets_ownerId_idx" ON "snippets"("ownerId");

-- CreateIndex
CREATE INDEX "snippets_language_idx" ON "snippets"("language");

-- CreateIndex
CREATE INDEX "fingerprints_hash_idx" ON "fingerprints"("hash");

-- CreateIndex
CREATE INDEX "fingerprints_snippetId_idx" ON "fingerprints"("snippetId");

-- AddForeignKey
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fingerprints" ADD CONSTRAINT "fingerprints_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "snippets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
