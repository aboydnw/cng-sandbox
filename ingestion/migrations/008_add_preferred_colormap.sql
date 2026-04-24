ALTER TABLE datasets    ADD COLUMN IF NOT EXISTS preferred_colormap          TEXT;
ALTER TABLE datasets    ADD COLUMN IF NOT EXISTS preferred_colormap_reversed BOOLEAN;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS preferred_colormap          TEXT;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS preferred_colormap_reversed BOOLEAN;
