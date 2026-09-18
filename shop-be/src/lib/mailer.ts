import nodemailer from 'nodemailer';
import { env } from './env';
import { vietQrImageUrl } from './bankQr';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' đ';

const transporter =
  env.emailUser && env.emailAppPassword
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: env.emailUser, pass: env.emailAppPassword },
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
  paymentMethod: 'COD' | 'BANK_TRANSFER';
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
        <p style="margin:8px 0 0;"><strong>Thanh toán:</strong> ${order.paymentMethod === 'COD' ? 'Tiền mặt khi nhận hàng' : 'Chuyển khoản ngân hàng'}</p>
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
