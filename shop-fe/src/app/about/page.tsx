// src/app/about/page.tsx
import { Sparkles, Heart, Leaf } from 'lucide-react';

export const metadata = { title: 'About Us — TAHO' };

const VALUES = [
  {
    icon: Sparkles,
    title: 'Chất lượng trước tiên',
    text: 'Từng đường may, chất vải đều được chọn lọc kỹ để món đồ bền đẹp qua nhiều lần mặc.',
  },
  {
    icon: Heart,
    title: 'Phong cách dễ mặc',
    text: 'Thiết kế tối giản, dễ phối đồ hằng ngày — không chạy theo trend nhất thời.',
  },
  {
    icon: Leaf,
    title: 'Giá thành hợp lý',
    text: 'Tối ưu chuỗi sản xuất để mang mức giá tốt nhất mà vẫn giữ chất lượng ổn định.',
  },
];

export default function AboutPage() {
  return (
    <div>
      <section className="about-hero">
        <div className="about-hero__overlay" />
        <div className="wrap about-hero__content">
          <p>Quần áo cơ bản, chất lượng tốt, giá hợp lý — TAHO đồng hành cùng phong cách của bạn.</p>
        </div>
      </section>

      <div className="wrap about-body">
        <h2>Câu chuyện của TAHO</h2>
        {/* CHO SUA SAU: thay toan bo doan duoi bang cau chuyen that ve TAHO
            (nam thanh lap, ly do bat dau, ky niem dang nho...). */}
        <p>
          TAHO ra đời với mong muốn mang đến những sản phẩm thời trang cơ bản, dễ phối đồ,
          chất lượng ổn định với mức giá hợp lý cho mọi người.
        </p>
        <p>
          Từ một cửa hàng nhỏ, TAHO dần xây dựng được cộng đồng khách hàng yêu thích phong
          cách tối giản, ưu tiên chất liệu thoải mái và độ bền theo thời gian hơn là chạy
          theo xu hướng ngắn hạn.
        </p>
        <p>
          Mỗi bộ sưu tập của TAHO đều bắt đầu từ một câu hỏi đơn giản: liệu mình có mặc lại
          món đồ này nhiều lần, trong nhiều dịp khác nhau không? Nếu câu trả lời là có, đó
          mới là sản phẩm xứng đáng được đưa vào cửa hàng.
        </p>
      </div>

      <div className="wrap about-values">
        {VALUES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="about-values__item">
            <Icon size={26} strokeWidth={1.5} />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
