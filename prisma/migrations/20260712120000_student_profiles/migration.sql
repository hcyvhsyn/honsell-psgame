-- University: dropdown mənbəyi (hardcode edilmir).
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "slug" TEXT NOT NULL,
    "city" TEXT,
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "University_slug_key" ON "University"("slug");
CREATE INDEX "University_isActive_idx" ON "University"("isActive");

-- StudentProfile: tələbə təsdiqi (Student Partner-dən AYRI entity).
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isStudent" BOOLEAN NOT NULL DEFAULT false,
    "universityId" TEXT,
    "course" TEXT,
    "studentCardKey" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
CREATE INDEX "StudentProfile_verificationStatus_idx" ON "StudentProfile"("verificationStatus");
CREATE INDEX "StudentProfile_universityId_idx" ON "StudentProfile"("universityId");

ALTER TABLE "StudentProfile"
    ADD CONSTRAINT "StudentProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentProfile"
    ADD CONSTRAINT "StudentProfile_universityId_fkey"
    FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Başlanğıc universitet siyahısı (admin sonradan əlavə/redaktə edə bilər).
INSERT INTO "University" ("id", "name", "shortName", "slug", "city", "isActive", "createdAt", "updatedAt") VALUES
    ('uni_unec',  'Azərbaycan Dövlət İqtisad Universiteti', 'UNEC', 'unec',  'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_bdu',   'Bakı Dövlət Universiteti',               'BDU',  'bdu',   'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_ada',   'ADA University',                          'ADA',  'ada',   'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_aztu',  'Azərbaycan Texniki Universiteti',         'AzTU', 'aztu',  'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_bmu',   'Bakı Mühəndislik Universiteti',           'BMU',  'bmu',   'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_atmu',  'Azərbaycan Tibb Universiteti',            'ATU',  'atu',   'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_khazar','Xəzər Universiteti',                      'Khazar','khazar','Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_qafqaz','Qafqaz Universiteti',                     NULL,   'qafqaz','Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_adnsu', 'Azərbaycan Dövlət Neft və Sənaye Universiteti', 'ADNSU', 'adnsu', 'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('uni_adpu',  'Azərbaycan Dövlət Pedaqoji Universiteti', 'ADPU', 'adpu',  'Bakı', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
