-- CreateTable
CREATE TABLE "OracleAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tenancy" TEXT NOT NULL,
    "userOcid" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "passphrase" TEXT,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OracleAccount_name_key" ON "OracleAccount"("name");
