ALTER TABLE "mizan"."Invitation" ADD COLUMN "acceptedById" UUID;
ALTER TABLE "mizan"."Invitation" ADD CONSTRAINT "Invitation_organizationId_acceptedById_fkey"
  FOREIGN KEY ("organizationId", "acceptedById") REFERENCES "mizan"."OrganizationMembership"("organizationId", "userId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Invitation_organizationId_acceptedById_idx" ON "mizan"."Invitation"("organizationId", "acceptedById");
