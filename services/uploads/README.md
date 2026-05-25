# Upload service

Upload handling is implemented in:

- `app/api/uploads/route.ts` — authenticated multipart upload
- `services/shared/src/storage/` — `LocalStorageProvider` (future `R2StorageProvider`)

Database stores **paths/URLs only**, never base64.
