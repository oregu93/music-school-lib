ALTER TABLE catalog_records
ADD COLUMN search_text TEXT NOT NULL DEFAULT '{}';
