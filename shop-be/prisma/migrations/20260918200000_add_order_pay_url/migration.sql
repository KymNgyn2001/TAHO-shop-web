-- Luu lai link/QR thanh toan MoMo/PayOS de khach quay lai don van thanh toan tiep duoc.
ALTER TABLE "Order" ADD COLUMN "payUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "payQrData" TEXT;
