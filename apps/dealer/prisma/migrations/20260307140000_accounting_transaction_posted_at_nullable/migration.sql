-- Make posted_at nullable so transactions can be draft until posted
ALTER TABLE "AccountingTransaction" ALTER COLUMN "posted_at" DROP NOT NULL;
