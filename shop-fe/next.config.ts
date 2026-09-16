import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next 16 mac dinh chi cho "localhost" goi dev server — moi IP LAN khac (dien thoai,
   * may khac trong wifi nha/truong) se bi chan ngam (trang van load nhung JS khong
   * chay duoc). Cho phep moi IP LAN rieng thay vi ghi chet 1 IP, de khoi phai sua
   * moi lan doi mang.
   */
  allowedDevOrigins: [
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*', '172.17.*.*', '172.18.*.*', '172.19.*.*',
    '172.20.*.*', '172.21.*.*', '172.22.*.*', '172.23.*.*',
    '172.24.*.*', '172.25.*.*', '172.26.*.*', '172.27.*.*',
    '172.28.*.*', '172.29.*.*', '172.30.*.*', '172.31.*.*',
  ],
};

export default nextConfig;
