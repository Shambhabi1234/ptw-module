-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'AREA_OWNER', 'SAFETY_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PermitType" AS ENUM ('HOT_WORK', 'CONFINED_SPACE', 'WORKING_AT_HEIGHT', 'ELECTRICAL_ISOLATION');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REJECTED', 'CLOSED', 'CLOSED_VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalRole" AS ENUM ('AREA_OWNER', 'SAFETY_OFFICER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PermitType" NOT NULL,
    "status" "PermitStatus" NOT NULL DEFAULT 'DRAFT',
    "requesterId" TEXT NOT NULL,
    "contractorName" TEXT NOT NULL,
    "workDescription" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "equipmentId" TEXT,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "hazards" TEXT[],
    "ppeRequired" TEXT[],
    "precautions" JSONB NOT NULL,
    "typeFields" JSONB NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermitApproval" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "approverRole" "ApprovalRole" NOT NULL,
    "approverId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermitApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtensionRequest" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ExtensionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_code_key" ON "Permit"("code");

-- CreateIndex
CREATE INDEX "Permit_status_idx" ON "Permit"("status");

-- CreateIndex
CREATE INDEX "Permit_type_idx" ON "Permit"("type");

-- CreateIndex
CREATE INDEX "Permit_areaId_idx" ON "Permit"("areaId");

-- CreateIndex
CREATE INDEX "Permit_plannedStart_plannedEnd_idx" ON "Permit"("plannedStart", "plannedEnd");

-- CreateIndex
CREATE INDEX "PermitApproval_permitId_idx" ON "PermitApproval"("permitId");

-- CreateIndex
CREATE INDEX "PermitApproval_approverId_idx" ON "PermitApproval"("approverId");

-- CreateIndex
CREATE INDEX "AuditLog_permitId_idx" ON "AuditLog"("permitId");

-- CreateIndex
CREATE INDEX "ExtensionRequest_permitId_idx" ON "ExtensionRequest"("permitId");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitApproval" ADD CONSTRAINT "PermitApproval_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermitApproval" ADD CONSTRAINT "PermitApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionRequest" ADD CONSTRAINT "ExtensionRequest_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionRequest" ADD CONSTRAINT "ExtensionRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
