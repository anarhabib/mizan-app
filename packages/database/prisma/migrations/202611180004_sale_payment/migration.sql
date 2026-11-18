ALTER TABLE "mizan"."Sale"
  ADD COLUMN "paymentCurrency" CHAR(3),
  ADD COLUMN "paymentAmount" DECIMAL(20,4),
  ADD COLUMN "paymentExchangeRate" DECIMAL(24,8),
  ADD COLUMN "convertedPayment" DECIMAL(32,4),
  ADD COLUMN "changeAmount" DECIMAL(32,4);
