/**
 * Thong bao loi tra cho nguoi dung phai co dau. Code backend viet message khong dau
 * cho gon, nen dich tap trung o day (errorHandler goi truoc khi gui ra ngoai) thay vi
 * sua tung noi. Message chua co trong bang thi giu nguyen.
 */
const EXACT: Record<string, string> = {
  'Khong tim thay.': 'Không tìm thấy.',
  'Vui long dang nhap.': 'Vui lòng đăng nhập.',
  'Ban khong co quyen thuc hien thao tac nay.': 'Bạn không có quyền thực hiện thao tác này.',
  'Thieu header X-Session-Id cho khach vang lai.': 'Thiếu phiên làm việc, bạn tải lại trang rồi thử lại nhé.',
  'Khong tim thay san pham.': 'Không tìm thấy sản phẩm.',
  'Thang khong hop le, dung dinh dang YYYY-MM.': 'Tháng không hợp lệ, dùng định dạng YYYY-MM.',
  'Thang khong hop le.': 'Tháng không hợp lệ.',
  'Ten danh muc khong duoc de trong.': 'Tên danh mục không được để trống.',
  'Khong tim thay danh muc.': 'Không tìm thấy danh mục.',
  'Loai nay da ton tai.': 'Loại này đã tồn tại.',
  'Con san pham trong danh muc nay, khong the xoa.': 'Còn sản phẩm trong danh mục này, không thể xoá.',
  'Ten khong duoc de trong.': 'Tên không được để trống.',
  'Email khong hop le.': 'Email không hợp lệ.',
  'Chi admin moi tao duoc tai khoan quan ly.': 'Chỉ admin mới tạo được tài khoản quản lý.',
  'Email nay da duoc su dung.': 'Email này đã được sử dụng.',
  'Email nay da duoc dang ky.': 'Email này đã được đăng ký.',
  'Khong tim thay tai khoan.': 'Không tìm thấy tài khoản.',
  'Tai khoan da bi xoa, hay khoi phuc truoc.': 'Tài khoản đã bị xoá, hãy khôi phục trước.',
  'Khong co gi de cap nhat.': 'Không có gì để cập nhật.',
  'Vui long nhap ten nguoi nhan.': 'Vui lòng nhập tên người nhận.',
  'So dien thoai khong hop le.': 'Số điện thoại không hợp lệ (cần 10 chữ số, VD 0901234567).',
  'Vui long nhap dia chi giao hang.': 'Vui lòng nhập địa chỉ giao hàng.',
  'Tai khoan nhan vien khong dung chuc nang mua hang.': 'Tài khoản nhân viên không dùng chức năng mua hàng.',
  'Tai khoan nhan vien khong dung chuc nang them vao gio hang.': 'Tài khoản nhân viên không dùng chức năng thêm vào giỏ hàng.',
  'Phuong thuc van chuyen khong hop le.': 'Phương thức vận chuyển không hợp lệ.',
  'Khong tim thay don hang.': 'Không tìm thấy đơn hàng.',
  'Vui long nhap ly do huy don.': 'Vui lòng nhập lý do huỷ đơn.',
  'Don da giao cho van chuyen, khong huy duoc nua.': 'Đơn đã giao cho vận chuyển, không huỷ được nữa.',
  'Don da huy, khong doi trang thai duoc nua.': 'Đơn đã huỷ, không đổi trạng thái được nữa.',
  'Don chua duoc xac nhan thanh toan, chua the chuyen trang thai.': 'Đơn chưa được xác nhận thanh toán, chưa thể chuyển trạng thái.',
  'Chi co the chuyen sang trang thai sau, khong lui lai duoc.': 'Chỉ có thể chuyển sang trạng thái sau, không lùi lại được.',
  'Khong tim thay san pham trong gio hang.': 'Không tìm thấy sản phẩm trong giỏ hàng.',
  'San pham khong con nua.': 'Sản phẩm không còn nữa.',
  'Ten san pham khong duoc de trong.': 'Tên sản phẩm không được để trống.',
  'Gia phai lon hon 0.': 'Giá phải lớn hơn 0.',
  'Can it nhat 1 anh san pham.': 'Cần ít nhất 1 ảnh sản phẩm.',
  'Can it nhat 1 phan loai (size/mau).': 'Cần ít nhất 1 phân loại (size/màu).',
  'Danh muc khong ton tai.': 'Danh mục không tồn tại.',
  'Noi dung danh gia khong duoc de trong.': 'Nội dung đánh giá không được để trống.',
  'San pham khong ton tai.': 'Sản phẩm không tồn tại.',
  'Ban da danh gia san pham nay roi.': 'Bạn đã đánh giá sản phẩm này rồi.',
  'Noi dung tra loi khong duoc de trong.': 'Nội dung trả lời không được để trống.',
  'Khong tim thay danh gia.': 'Không tìm thấy đánh giá.',
  'Danh gia nay da duoc tra loi.': 'Đánh giá này đã được trả lời.',
  'Dinh dang anh khong duoc ho tro.': 'Định dạng ảnh không được hỗ trợ (chỉ nhận JPG, PNG, WEBP).',
  'Thieu file anh.': 'Chưa chọn ảnh.',
  'Mat khau phai co it nhat 6 ky tu.': 'Mật khẩu phải có ít nhất 6 ký tự.',
  'Email hoac mat khau khong dung.': 'Email hoặc mật khẩu không đúng.',
  'Thieu token.': 'Thiếu mã đặt lại mật khẩu.',
  'Link dat lai mat khau khong hop le hoac da het han.': 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
  'Vui long nhap mat khau hien tai.': 'Vui lòng nhập mật khẩu hiện tại.',
  'Mat khau moi phai co it nhat 6 ky tu.': 'Mật khẩu mới phải có ít nhất 6 ký tự.',
  'Mat khau hien tai khong dung.': 'Mật khẩu hiện tại không đúng.',
  'Mat khau moi phai khac mat khau hien tai.': 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  'Da doi mat khau.': 'Đã đổi mật khẩu.',
  'Da dat lai mat khau. Ban dang nhap lai voi mat khau moi nhe.': 'Đã đặt lại mật khẩu. Bạn đăng nhập lại với mật khẩu mới nhé.',
  'Neu email nay ton tai trong he thong, minh da gui link dat lai mat khau roi.': 'Nếu email này tồn tại trong hệ thống, mình đã gửi link đặt lại mật khẩu rồi.',
  'Khong tim thay duong dan nay.': 'Không tìm thấy đường dẫn này.',
  'Loi he thong. Vui long thu lai sau.': 'Lỗi hệ thống. Vui lòng thử lại sau.',
  'Anh vuot qua 10MB.': 'Ảnh vượt quá 10MB, bạn nén nhỏ lại rồi thử tiếp nhé.',
};

const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Khong tim thay san pham \(variant #(\d+)\)\.$/, (m) => `Không tìm thấy sản phẩm (mã biến thể #${m[1]}), bạn tải lại giỏ hàng nhé.`],
  [/^(.+) size (\S+) vua het hang\.$/, (m) => `${m[1]} size ${m[2]} vừa hết hàng.`],
  [/^Size (\S+) chi con (\d+) san pham\.$/, (m) => `Size ${m[1]} chỉ còn ${m[2]} sản phẩm.`],
  [/^Chi con (\d+) san pham\.$/, (m) => `Chỉ còn ${m[1]} sản phẩm.`],
];

/** Zod mac dinh tra tieng Anh khi sai kieu/enum — doi sang cau de hieu. */
function zodFallback(msg: string): string | null {
  if (/^Required$/i.test(msg)) return 'Bạn chưa điền đủ thông tin bắt buộc.';
  if (/^Invalid enum value/i.test(msg)) return 'Giá trị chọn không hợp lệ.';
  if (/^Expected (number|string|boolean|array|object), received/i.test(msg)) return 'Dữ liệu nhập không đúng định dạng.';
  if (/^Invalid email/i.test(msg)) return 'Email không hợp lệ.';
  if (/^String must contain at least (\d+) character/i.test(msg)) return 'Nội dung nhập quá ngắn.';
  if (/^Number must be (greater|less)/i.test(msg)) return 'Số nhập không hợp lệ.';
  if (/^Invalid/i.test(msg)) return 'Dữ liệu nhập không hợp lệ.';
  return null;
}

export function viMessage(msg: string): string {
  if (EXACT[msg]) return EXACT[msg];
  for (const [re, fn] of PATTERNS) {
    const m = re.exec(msg);
    if (m) return fn(m);
  }
  return zodFallback(msg) ?? msg;
}
