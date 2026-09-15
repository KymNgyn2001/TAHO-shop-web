# Deploy shop-fe + shop-be

FE lên Vercel, BE + Postgres lên Railway (Render cũng làm y hệt các bước, chỉ khác giao diện).
Code đã sẵn sàng deploy (có `shop-be/Dockerfile`, biến môi trường đọc từ `process.env`).

## 0. Đẩy code lên GitHub

Repo git đã được khởi tạo sẵn ở thư mục gốc (`Mq/`). Bạn đã có sẵn repo GitHub
`https://github.com/KymNgyn2001/TAHO-shop-web` (hiện đang trống, chỉ có README/LICENSE) —
dùng repo đó, không cần tạo repo mới:

```bash
cd Mq
git remote add origin https://github.com/KymNgyn2001/TAHO-shop-web.git
git branch -M main
git push -u origin main --force
```

Dùng `--force` vì repo trên GitHub đang có sẵn 1 commit "Initial commit" (README+LICENSE)
không liên quan tới code này — force-push sẽ thay bằng lịch sử của `Mq`. Nếu muốn giữ lại
LICENSE gốc, tải file đó về bỏ vào thư mục `Mq` trước khi push.

(Thư mục `TAHO-shop-web/` nằm trong `Mq/` là bản clone rời của chính repo đó — không phải
một phần của code, đã được thêm vào `.gitignore` để tránh lẫn lộn. Có thể xoá thư mục đó
đi sau khi push thành công.)

## 1. Backend + Postgres trên Railway

1. Vào https://railway.app → New Project → **Deploy from GitHub repo** → chọn repo vừa push.
2. Railway sẽ hỏi thư mục gốc của service — chọn **Root Directory: `shop-be`** (vì
   repo có cả FE lẫn BE). Railway tự nhận diện `Dockerfile` và build bằng Docker.
3. Trong project đó, bấm **+ New → Database → PostgreSQL** để thêm Postgres.
4. Vào service backend → tab **Variables**, thêm:
   ```
   DATABASE_URL   = ${{Postgres.DATABASE_URL}}   # Railway cho reference biến này
   JWT_SECRET     = <chuoi ngau nhien dai, vd chay: openssl rand -hex 32>
   JWT_EXPIRES_IN = 7d
   CORS_ORIGIN    = http://localhost:3000        # sua lai sau khi co domain Vercel
   UPLOAD_DIR     = uploads
   MAX_UPLOAD_MB  = 5
   ```
   (`PORT` Railway tự set, không cần thêm.)
5. (Khuyên dùng) Vào tab **Volumes**, mount 1 volume vào path `/app/uploads` —
   nếu không, ảnh sản phẩm upload lên sẽ mất mỗi lần deploy lại (ổ đĩa container là tạm thời).
6. Deploy xong, vào tab **Settings → Networking → Generate Domain** để có URL public,
   dạng `https://shop-be-production-xxxx.up.railway.app`. Đây là `NEXT_PUBLIC_API_URL` cho FE.
7. Chạy seed dữ liệu mẫu (tài khoản demo + sản phẩm mẫu) — trong tab **Settings** của service
   có nút chạy lệnh một lần, hoặc dùng Railway CLI:
   ```bash
   npm install -g @railway/cli
   railway login
   railway link          # chon dung project
   railway run npm run seed
   ```

Backend chạy `npx prisma migrate deploy` tự động mỗi lần start container (đã cấu hình
trong `Dockerfile`), nên không cần chạy migrate tay.

## 2. Frontend trên Vercel

1. Vào https://vercel.com/new → Import repo GitHub vừa push.
2. Ở bước cấu hình, đổi **Root Directory** thành `shop-fe`.
3. Thêm Environment Variables:
   ```
   NEXT_PUBLIC_USE_MOCK = false
   NEXT_PUBLIC_API_URL  = https://shop-be-production-xxxx.up.railway.app   (URL Railway o buoc tren)
   ```
4. Bấm Deploy. Xong sẽ có domain dạng `https://<ten-project>.vercel.app`.

## 3. Nối vòng lặp CORS

Quay lại Railway → service backend → Variables → sửa:
```
CORS_ORIGIN = https://<ten-project>.vercel.app
```
(có thể liệt kê nhiều origin, cách nhau bởi dấu phẩy, ví dụ giữ cả
`http://localhost:3000` để vẫn dev được ở máy local). Railway tự redeploy khi lưu biến.

## 4. Kiểm tra

- Mở domain Vercel → thử đăng ký tài khoản mới, đăng nhập bằng tài khoản demo
  (`manager@shop.test` / `Manager123!`), thêm sản phẩm vào giỏ, đặt hàng thử.
- Nếu lỗi "Không kết nối được máy chủ": kiểm tra lại `NEXT_PUBLIC_API_URL` trên Vercel
  và `CORS_ORIGIN` trên Railway có khớp domain nhau không.

## Sau này đổi ảnh sản phẩm sang lưu trên cloud (không bắt buộc)

Nếu không muốn phụ thuộc Volume của Railway, có thể đổi `shop-be/src/middleware/upload.ts`
sang upload lên Cloudflare R2 / AWS S3 thay vì đĩa cục bộ — phần còn lại của API (contract
với FE) không đổi.
