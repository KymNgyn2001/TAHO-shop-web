-- Nhan vien an/hien san pham khoi tim kiem + danh sach cong khai.
ALTER TABLE "Product" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
