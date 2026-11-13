UPDATE "RefreshToken" AS token
SET "revokedAt" = CURRENT_TIMESTAMP
FROM "User" AS employee
WHERE token."userId" = employee."id"
  AND employee."role" <> 'OWNER'
  AND token."revokedAt" IS NULL;