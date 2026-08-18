-- Profile photos now stored directly in the DB as a data URI instead of
-- R2 — see lib/photo.js's profilePhotoViewUrl and User.photoBase64's
-- own comment in schema.prisma. photoR2Key stays as a read-only
-- fallback for accounts that uploaded before this switch.

ALTER TABLE "User" ADD COLUMN "photoBase64" TEXT;
