-- Save receipt identity independently of editable and dissolvable sets.
ALTER TABLE "mizan"."Sale"
ADD COLUMN "jewelrySetId" UUID,
ADD COLUMN "jewelrySetName" TEXT;
