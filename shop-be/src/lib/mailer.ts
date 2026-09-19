import nodemailer from 'nodemailer';
import { env } from './env';
import { vietQrImageUrl } from './bankQr';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

// App Password Google hien thi kem dau cach ("abcd efgh ijkl mnop") — bo het khoang trang cho chac.
const transporter =
  env.emailUser && env.emailAppPassword
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: env.emailUser, pass: env.emailAppPassword.replace(/\s+/g, '') },
        // Neu SMTP bi chan (VD Render goi mien phi chan cong 465/587) thi bao loi nhanh, khong treo 2 phut.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      })
    : null;

if (!transporter) {
  // eslint-disable-next-line no-console
  console.warn('[mailer] Thieu EMAIL_USER/EMAIL_APP_PASSWORD — bo qua gui email xac nhan don hang.');
}

type OrderForEmail = {
  code: string;
  receiverName: string;
  receiverPhone: string;
  shippingAddress: string;
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'MOMO';
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  shippingMethodName: string | null;
  items: { productName: string; size: string; color: string; quantity: number; lineTotal: number }[];
};

function buildOrderEmailHtml(order: OrderForEmail): string {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${i.productName}<br/>
          <span style="color:#777;font-size:12px;">${i.color} · ${i.size} × ${i.quantity}</span>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${vnd(i.lineTotal)}</td>
      </tr>`,
    )
    .join('');

  const qrBlock =
    order.paymentMethod === 'BANK_TRANSFER'
      ? `<div style="margin:20px 0;text-align:center;">
           <p style="font-size:14px;color:#333;">Vui lòng chuyển khoản và ghi nội dung <strong>${order.code}</strong>:</p>
           <img src="${vietQrImageUrl(order.totalAmount, order.code)}" alt="QR chuyển khoản" style="max-width:220px;border:1px solid #eee;border-radius:8px;" />
         </div>`
      : '';

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#22201C;">
    <div style="background:#22201C;color:#fff;padding:20px;text-align:center;">
      <span style="font-size:22px;font-weight:bold;letter-spacing:1px;">TAHO</span>
    </div>
    <div style="padding:24px 20px;">
      <h2 style="margin:0 0 4px;font-weight:500;">Cảm ơn bạn đã đặt hàng!</h2>
      <p style="color:#666;margin:0 0 20px;">Mã đơn hàng: <strong>${order.code}</strong></p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>

      <table style="width:100%;font-size:14px;margin-top:12px;">
        <tr><td style="padding:4px 0;color:#666;">Tạm tính</td><td style="text-align:right;">${vnd(order.subtotal)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Vận chuyển${order.shippingMethodName ? ` (${order.shippingMethodName})` : ''}</td><td style="text-align:right;">${order.shippingFee === 0 ? 'Miễn phí' : vnd(order.shippingFee)}</td></tr>
        ${order.discountAmount > 0 ? `<tr><td style="padding:4px 0;color:#666;">Giảm giá</td><td style="text-align:right;">-${vnd(order.discountAmount)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #eee;">Tổng cộng</td><td style="text-align:right;font-weight:bold;border-top:1px solid #eee;">${vnd(order.totalAmount)}</td></tr>
      </table>

      ${qrBlock}

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eee;font-size:13px;color:#666;">
        <p style="margin:0 0 4px;"><strong>Người nhận:</strong> ${order.receiverName} · ${order.receiverPhone}</p>
        <p style="margin:0;"><strong>Địa chỉ:</strong> ${order.shippingAddress}</p>
        <p style="margin:8px 0 0;"><strong>Thanh toán:</strong> ${
          order.paymentMethod === 'COD' ? 'Tiền mặt khi nhận hàng' : order.paymentMethod === 'MOMO' ? 'Ví MoMo' : 'Chuyển khoản ngân hàng'
        }</p>
      </div>
    </div>
    <div style="background:#f5f5f4;padding:14px 20px;text-align:center;font-size:12px;color:#888;">
      TAHO · tahowear@gmail.com · 0939 299 099
    </div>
  </div>`;
}

export async function sendOrderConfirmationEmail(to: string, order: OrderForEmail): Promise<void> {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"TAHO" <${env.emailUser}>`,
      to,
      subject: `Xác nhận đơn hàng ${order.code} — TAHO`,
      html: buildOrderEmailHtml(order),
    });
  } catch (e) {
    // Khong throw — don hang van tao thanh cong du gui mail that bai.
    // eslint-disable-next-line no-console
    console.error('[mailer] Gui email xac nhan don hang that bai:', e);
  }
}

/** true neu gui thanh cong — auth.routes.ts can biet de bao loi neu mailer chua
 * cau hinh (khong the "quen mat khau" duoc neu khong gui mail duoc). */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: `"TAHO" <${env.emailUser}>`,
      to,
      subject: 'Đặt lại mật khẩu — TAHO',
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#22201C;">
          <div style="background:#22201C;color:#fff;padding:20px;text-align:center;">
            <span style="font-size:22px;font-weight:bold;letter-spacing:1px;">TAHO</span>
          </div>
          <div style="padding:24px 20px;">
            <h2 style="margin:0 0 12px;font-weight:500;">Đặt lại mật khẩu</h2>
            <p style="color:#444;font-size:14px;line-height:1.6;">
              Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản TAHO gắn với email này.
              Bấm nút bên dưới để đặt mật khẩu mới — link có hiệu lực trong 1 giờ.
            </p>
            <p style="text-align:center;margin:28px 0;">
              <a href="${resetUrl}" style="background:#22201C;color:#fff;text-decoration:none;padding:12px 28px;border-radius:4px;font-size:14px;display:inline-block;">Đặt lại mật khẩu</a>
            </p>
            <p style="color:#888;font-size:12px;">
              Nếu bạn không yêu cầu việc này, cứ bỏ qua email — mật khẩu hiện tại vẫn giữ nguyên.
            </p>
          </div>
          <div style="background:#f5f5f4;padding:14px 20px;text-align:center;font-size:12px;color:#888;">
            TAHO · tahowear@gmail.com · 0939 299 099
          </div>
        </div>`,
    });
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[mailer] Gui email dat lai mat khau that bai:', e);
    return false;
  }
}


/** Bao khach da nhan duoc mot phan tien nhung con thieu — tranh khach tuong da xong. */
export async function sendPaymentShortfallEmail(
  to: string,
  info: { code: string; paid: number; total: number; payUrl: string | null },
): Promise<void> {
  if (!transporter) return;
  const missing = info.total - info.paid;
  try {
    await transporter.sendMail({
      from: `"TAHO" <${env.emailUser}>`,
      to,
      subject: `Đơn ${info.code} còn thiếu ${vnd(missing)} — TAHO`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#22201C;">
          <div style="background:#22201C;color:#fff;padding:20px;text-align:center;">
            <span style="font-size:22px;font-weight:bold;letter-spacing:1px;">TAHO</span>
          </div>
          <div style="padding:24px 20px;font-size:14px;line-height:1.6;">
            <h2 style="margin:0 0 12px;font-weight:500;">Đơn ${info.code} chưa đủ tiền</h2>
            <p>Mình đã nhận <strong>${vnd(info.paid)}</strong> trên tổng <strong>${vnd(info.total)}</strong>.
            Bạn vui lòng chuyển nốt <strong>${vnd(missing)}</strong> (ghi đúng nội dung <strong>${info.code}</strong>) để đơn được xác nhận.</p>
            ${info.payUrl ? `<p style="text-align:center;margin:24px 0;"><a href="${info.payUrl}" style="background:#22201C;color:#fff;text-decoration:none;padding:12px 28px;border-radius:4px;display:inline-block;">Chuyển nốt số còn thiếu</a></p>` : ''}
            <p style="color:#888;font-size:12px;">Nếu bạn đã chuyển đủ mà vẫn nhận mail này, hãy liên hệ shop: 0939 299 099.</p>
          </div>
        </div>`,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[mailer] Gui email thieu tien that bai:', e);
  }
}

/** Bao khach da nhan du tien va don da duoc xac nhan (chuyen khoan/MoMo). */
export async function sendPaymentReceivedEmail(
  to: string,
  info: { code: string; receiverName: string; paid: number; total: number },
): Promise<void> {
  if (!transporter) return;
  const extra = info.paid - info.total;
  try {
    await transporter.sendMail({
      from: `"TAHO" <${env.emailUser}>`,
      to,
      subject: `Đã nhận thanh toán đơn ${info.code} — TAHO`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#22201C;">
          <div style="background:#22201C;color:#fff;padding:20px;text-align:center;">
            <span style="font-size:22px;font-weight:bold;letter-spacing:1px;">TAHO</span>
          </div>
          <div style="padding:24px 20px;font-size:14px;line-height:1.6;">
            <h2 style="margin:0 0 12px;font-weight:500;">Thanh toán thành công</h2>
            <p>Chào ${info.receiverName}, mình đã nhận được <strong>${vnd(info.paid)}</strong> cho đơn <strong>${info.code}</strong>
            (giá trị đơn ${vnd(info.total)}). Đơn của bạn đã được <strong>xác nhận</strong> và shop sẽ chuẩn bị giao hàng sớm nhất.</p>
            ${extra > 0 ? `<p style="background:#f5f5f4;padding:10px 12px;border-radius:4px;">Bạn đã chuyển dư <strong>${vnd(extra)}</strong>. Shop sẽ liên hệ để hoàn lại phần dư cho bạn.</p>` : ''}
            <p style="color:#888;font-size:12px;">Cần hỗ trợ? Liên hệ 0939 299 099 · tahowear@gmail.com</p>
          </div>
        </div>`,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[mailer] Gui email da nhan thanh toan that bai:', e);
  }
}

export function mailStatus(): { configured: boolean; user: string } {
  return { configured: transporter !== null, user: env.emailUser ? env.emailUser.replace(/^(.).*(@.*)$/, '$1***$2') : '' };
}

/** Gui thu that va tra ve loi cu the (khac cac ham khac la nuot loi) — de chan doan vi sao khach khong nhan duoc mail. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  if (!transporter) return { ok: false, error: 'Chua cau hinh EMAIL_USER/EMAIL_APP_PASSWORD tren server.' };
  try {
    await transporter.sendMail({
      from: `"TAHO" <${env.emailUser}>`,
      to,
      subject: 'Email thử từ TAHO',
      html: '<p>Nếu bạn nhận được email này thì hệ thống gửi mail của TAHO đang hoạt động.</p>',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${(e as { code?: string }).code ?? ''} ${e.message}`.trim() : String(e) };
  }
}