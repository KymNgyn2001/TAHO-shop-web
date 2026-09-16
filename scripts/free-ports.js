// Dung truoc "npm run dev": dung moi tien trinh dang LISTEN o cac port truyen vao,
// de khong phai tu tay Ctrl+C cac terminal cu (VD: 3000 cho FE, 8080 cho BE).
const { execSync } = require('child_process');

const ports = process.argv.slice(2).map(Number).filter(Boolean);

for (const port of ports) {
  let out;
  try {
    out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  } catch {
    continue; // khong co gi dang chay tren port nay
  }

  const pids = new Set();
  for (const line of out.split('\n')) {
    const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
    if (m) pids.add(m[1]);
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      console.log(`[free-ports] Da dung tien trinh cu tren port ${port} (PID ${pid}).`);
    } catch {
      // tien trinh co the da tu thoat giua chung
    }
  }
}
