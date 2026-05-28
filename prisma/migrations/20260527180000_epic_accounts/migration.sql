-- Epic Games (Türkiye) delivery accounts we create for customers, plus a link
-- from a Transaction to the Epic account it targets / created.

CREATE TABLE "EpicAccount" (
  "id"           TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "label"        TEXT         NOT NULL,
  "firstName"    TEXT         NOT NULL,
  "lastName"     TEXT         NOT NULL,
  "birthDate"    TEXT         NOT NULL,
  "epicEmail"    TEXT         NOT NULL,
  "epicPassword" TEXT         NOT NULL,
  "displayName"  TEXT         NOT NULL,
  "isDefault"    BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EpicAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EpicAccount_userId_idx" ON "EpicAccount" ("userId");

ALTER TABLE "EpicAccount"
  ADD CONSTRAINT "EpicAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD COLUMN "epicAccountId" TEXT;

ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_epicAccountId_fkey"
  FOREIGN KEY ("epicAccountId") REFERENCES "EpicAccount" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
