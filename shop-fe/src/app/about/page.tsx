// src/app/about/page.tsx
export const metadata = { title: 'About Us — TAHO' };

export default function AboutPage() {
  return (
    <div>
      <section className="about-hero">
        <div className="about-hero__overlay" />
        <div className="wrap about-hero__content">
          <h1>About Us</h1>
          <p>Quần áo cơ bản, chất lượng tốt, giá hợp lý — TAHO đồng hành cùng phong cách của bạn.</p>
        </div>
      </section>

      <div className="wrap about-body">
        <h2>Câu chuyện của TAHO</h2>
        <p>
          {/* CHO SUA SAU: thay bang noi dung gioi thieu that ve TAHO */}
          TAHO ra đời với mong muốn mang đến những sản phẩm thời trang cơ bản, dễ phối đồ,
          chất lượng ổn định với mức giá hợp lý cho mọi người.
        </p>
      </div>
    </div>
  );
}
