-- Track per-transaction customer savings (originalAzn − finalAzn × qty, in qəpik)
ALTER TABLE "Transaction"
  ADD COLUMN "savingsAznCents" INTEGER NOT NULL DEFAULT 0;

-- One-time token sent to manually-created users so they can set their own
-- password and verify their email via /set-password?token=…
ALTER TABLE "User"
  ADD COLUMN "setPasswordToken" TEXT,
  ADD COLUMN "setPasswordTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_setPasswordToken_key"
  ON "User"("setPasswordToken");
