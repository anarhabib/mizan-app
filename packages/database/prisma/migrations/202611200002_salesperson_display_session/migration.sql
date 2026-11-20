CREATE TABLE "mizan"."SalespersonDisplaySession" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    CONSTRAINT "SalespersonDisplaySession_pkey" PRIMARY KEY ("sessionId"),
    CONSTRAINT "SalespersonDisplaySession_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "mizan"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SalespersonDisplaySession_userId_idx" ON "mizan"."SalespersonDisplaySession"("userId");
