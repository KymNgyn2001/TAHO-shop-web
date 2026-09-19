# shop-be

Backend cho `shop-fe`, hiện thực đúng hợp đồng trong
`shop-fe/src/lib/api-contract.ts` và `api-contract-admin.ts`.

Stack: Node.js + Express + TypeScript + Prisma + PostgreSQL.

## Postgres cục bộ (máy Windows này)

PostgreSQL 18 đã cài nhưng service Windows chưa được tạo (cần quyền admin) nên
mình khởi tạo 1 cluster riêng ở `C:\Users\NGUYNT~1\pgdata-shop` (đường dẫn rút gọn
để né lỗi encoding của initdb với tên thư mục có dấu) và chạy thủ công bằng `pg_ctl`.

**Mỗi lần mở máy lên muốn chạy BE, bật Postgres trước:**

```bash
npm run db:up      # bật Postgres
npm run db:status  # kiểm tra đang chạy hay không
npm run db:down    # tắt Postgres khi xong việc
```

Thông tin kết nối (dùng cho pgAdmin "Register Server" hoặc bất kỳ tool nào khác):

| Trường    | Giá trị           |
|-----------|--------------------|
| Host      | localhost          |
| Port      | 5432               |
| Database  | shop               |
| Username  | postgres           |
| Password  | ShopDb123!         |

Muốn service tự bật khi khởi động Windows (không phải gõ `npm run db:up` mỗi lần):
mở Command Prompt **as Administrator** rồi chạy:

```bash
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" register -N "postgresql-shop" -D "C:\Users\NGUYNT~1\pgdata-shop" -U "NT AUTHORITY\NetworkService"
sc start postgresql-shop
```

## Cài đặt & chạy lần đầu

```bash
cd shop-be
npm install
npm run db:up                         # bật Postgres (xem phần trên)
npx prisma migrate dev --name init    # tạo bảng trong database "shop"
npm run seed                          # tạo danh mục/sản phẩm/tài khoản mẫu
npm run dev                           # chạy tại http://localhost:8080
```

Sau khi backend chạy, mở `shop-fe/.env.local`, đổi:

```
NEXT_PUBLIC_USE_MOCK=false
```

rồi chạy lại `npm run dev` bên `shop-fe` — không cần sửa dòng UI nào.

## Tài khoản demo (tạo bởi `npm run seed`)

| Vai trò   | Email                | Mật khẩu       |
|-----------|-----------------------|----------------|
| MANAGER   | manager@shop.test     | Manager123!    |
| EMPLOYEE  | employee@shop.test    | Employee123!   |
| CUSTOMER  | customer@shop.test    | Customer123!   |

> Các tài khoản demo trên chỉ để chạy thử. **Không dùng lại mật khẩu này trên production** —
> đổi mật khẩu (menu tài khoản → "Đổi mật khẩu") hoặc xoá mềm các tài khoản demo sau khi deploy.

## Tài khoản ADMIN

Admin là vai trò cao nhất: làm được mọi việc của manager và là vai trò duy nhất tạo/quản lý
tài khoản Manager (menu "Quản lý tài khoản"). **Mật khẩu admin không ghi trong repo** (repo công khai).

- **Production (Render):** thêm 2 biến môi trường, server tự tạo tài khoản khi khởi động
  (nếu email đã có thì chỉ nâng lên ADMIN, không đổi mật khẩu):
  ```
  ADMIN_EMAIL=<email đăng nhập admin>
  ADMIN_PASSWORD=<mật khẩu admin — đặt mạnh, không dùng chung với nơi khác>
  ```
  Đăng nhập xong nên đổi lại mật khẩu ở menu "Đổi mật khẩu".
- **Local:** `npm run seed` tạo `admin@shop.test` (mật khẩu ghi trong `prisma/seed.ts`, chỉ dùng cho DB local).

## Gửi email (xác nhận đơn, thanh toán, quên mật khẩu)

Render bản miễn phí **chặn cổng SMTP** nên Gmail SMTP không chạy được trên production. Dùng Brevo (HTTPS):

```
BREVO_API_KEY=<API key trong Brevo → SMTP & API → API keys>
EMAIL_SENDER=<email gửi đi, đã xác minh trong Brevo → Senders>
```

Trên Brevo phải **tắt chặn IP lạ** (Security → Authorised IPs) vì Render không có IP cố định.
Kiểm tra sau khi deploy: đăng nhập manager/admin, gọi `POST /api/admin/email-test` với `{"to":"<email>"}`
để thấy lỗi gửi mail thật (nếu có). Chạy local có thể dùng `EMAIL_USER` + `EMAIL_APP_PASSWORD` (Gmail App Password).

Mã giảm giá mẫu: `WELCOME10` (giảm 10%, đơn tối thiểu 300k), `FREESHIP30` (giảm cố định 30k).

## Vai trò & quyền

- **CUSTOMER**: đăng ký/đăng nhập/đăng xuất, xem & viết review, giỏ hàng, đặt hàng
  (chọn ship + mã giảm giá), xem/huỷ đơn của mình, chat với bot.
- **EMPLOYEE**: đăng nhập/đăng xuất, tạo danh mục, đăng sản phẩm (ảnh + mô tả + bảng size),
  xem review khách hàng và trả lời.
- **MANAGER**: mọi quyền của EMPLOYEE về xem review, cộng thêm xem KPI/doanh thu
  (`/api/admin/stats/monthly`), xem tình trạng đơn hàng (`/api/admin/transactions`),
  tạo tài khoản nhân viên (`/api/manager/employees`, có thể để trống mật khẩu để hệ thống
  tự sinh — trả về `temporaryPassword` đúng 1 lần).

Khách vãng lai (chưa đăng nhập) vẫn dùng được giỏ hàng/đặt hàng qua header
`X-Session-Id` (FE đã tự sinh UUID lưu localStorage) — giỏ hàng sẽ tự gộp vào
tài khoản ngay khi khách đăng nhập.

## Ghi chú về tìm kiếm & chatbot

`/api/search/semantic` và `/api/chat` dùng so khớp từ khoá trên tên/mô tả/chất liệu
(không gọi model embedding ngoài, không cần API key). `/api/search/image` hiện trả về
sản phẩm được xem nhiều nhất làm gợi ý tạm thời (chưa có mô hình nhận diện ảnh thật) —
nếu sau này có ngân sách dùng OpenAI/Gemini vision hoặc pgvector, chỉ cần thay nội dung
2 route này, hợp đồng API với FE không đổi.

## Upload ảnh

`POST /api/admin/uploads` (EMPLOYEE/MANAGER) nhận multipart field `file`, giới hạn 5MB,
chỉ nhận jpeg/png/webp, lưu vào `uploads/YYYY/MM/`, phục vụ tĩnh tại `/uploads/...`.
Khi đăng sản phẩm, gọi upload trước để lấy `url`, rồi đưa vào `imageUrls`/`sizeChartImageUrl`
của `POST /api/admin/products`.
