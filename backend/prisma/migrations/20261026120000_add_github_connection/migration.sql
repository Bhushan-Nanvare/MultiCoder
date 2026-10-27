-- Repository access is a separate opt-in from sign-in, so the token lives on
-- the user and is stored encrypted. Additive: existing rows stay NULL and the
-- integration is simply not connected.

ALTER TABLE "users" ADD COLUMN "githubToken" TEXT;
ALTER TABLE "users" ADD COLUMN "githubScope" TEXT;
ALTER TABLE "users" ADD COLUMN "githubConnectedAt" TIMESTAMP(3);
