-- Optional court capacity; null = unlimited
-- IF NOT EXISTS: safe when runtime ensureMaxPlayersColumn already patched prod/preview
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "maxPlayers" INTEGER;
