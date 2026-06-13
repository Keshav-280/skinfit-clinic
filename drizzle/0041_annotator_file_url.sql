-- Annotator images: store R2/local paths in file_url; data_uri optional (legacy rows only)
ALTER TABLE annotator_images
  ALTER COLUMN data_uri DROP NOT NULL;

COMMENT ON COLUMN annotator_images.file_url IS 'Storage path e.g. annotator/uuid.jpg (R2 or local)';
COMMENT ON COLUMN annotator_images.data_uri IS 'Legacy inline image; new rows use file_url only';
