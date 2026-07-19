-- Migration 055: coordinate del comune sul profilo marketplace
-- Servono alla ricerca "Vicino a me" (ordina i professionisti per distanza
-- dal cliente). Popolate dalla geocodifica del comune al salvataggio del
-- profilo (lib/geocode.ts, provider OpenStreetMap). Restano NULL se il comune
-- non viene riconosciuto → il professionista resta cercabile per parola, ma
-- non entra nell'ordinamento per distanza.

ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE marketplace_profiles ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
