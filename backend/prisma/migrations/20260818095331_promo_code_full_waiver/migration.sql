-- MVP-launch promo codes that waive the platform fee entirely, instead
-- of just knocking a fixed discountInr off it — see lib/credits.js and
-- routes/promoCodes.routes.js.

ALTER TABLE "PromoCode" ADD COLUMN "fullWaiver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserCredit" ADD COLUMN "fullWaiver" BOOLEAN NOT NULL DEFAULT false;
