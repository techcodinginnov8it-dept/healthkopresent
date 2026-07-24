-- Backfill central User rows for legacy profile records before enforcing required 1-to-1 links.

INSERT INTO "users" (id, email, password, role, "isActive", "emailVerified", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  p.email,
  p.password,
  'PATIENT',
  p."isActive",
  p."emailVerified",
  p."createdAt",
  p."updatedAt"
FROM "patients" p
WHERE p."user_id" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "users" u
    WHERE u.email = p.email
  );

UPDATE "patients" p
SET "user_id" = u.id
FROM "users" u
WHERE p."user_id" IS NULL
  AND u.email = p.email;

INSERT INTO "users" (id, email, password, role, "isActive", "emailVerified", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  d.email,
  d.password,
  'DOCTOR',
  d."isActive",
  true,
  d."createdAt",
  d."updatedAt"
FROM "doctors" d
WHERE d."user_id" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "users" u
    WHERE u.email = d.email
  );

UPDATE "doctors" d
SET "user_id" = u.id
FROM "users" u
WHERE d."user_id" IS NULL
  AND u.email = d.email;

INSERT INTO "users" (id, email, password, role, "isActive", "emailVerified", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  a.email,
  COALESCE(u.password, 'placeholder'),
  'ADMIN',
  true,
  true,
  a."createdAt",
  a."updatedAt"
FROM "admins" a
LEFT JOIN "users" u ON u.email = a.email
WHERE a."user_id" IS NULL
  AND u.id IS NULL;

UPDATE "admins" a
SET "user_id" = u.id
FROM "users" u
WHERE a."user_id" IS NULL
  AND u.email = a.email;
