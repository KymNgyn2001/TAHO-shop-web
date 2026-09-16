import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './lib/env';
import { identify } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { withRequestBaseUrl } from './lib/requestContext';

import { authRouter } from './routes/auth.routes';
import { categoriesRouter } from './routes/categories.routes';
import { productsRouter } from './routes/products.routes';
import { searchRouter } from './routes/search.routes';
import { cartRouter } from './routes/cart.routes';
import { ordersRouter } from './routes/orders.routes';
import { reviewsRouter } from './routes/reviews.routes';
import { shippingRouter } from './routes/shipping.routes';
import { discountsRouter } from './routes/discounts.routes';
import { uploadsRouter } from './routes/uploads.routes';
import { statsRouter } from './routes/stats.routes';
import { employeesRouter } from './routes/employees.routes';
import { chatRouter } from './routes/chat.routes';

export const app = express();

/** Can thiet khi deploy sau reverse proxy (Railway/Render/Vercel...): proxy nhan HTTPS
 * roi forward vao container qua HTTP, tin "X-Forwarded-Proto" thi req.protocol moi
 * tra ve dung "https" — neu khong, link anh tu dong sinh ra (requestContext.ts) se
 * bi sai thanh http:// va bi trinh duyet chan (mixed content) tren trang https. */
app.set('trust proxy', 1);

/** localhost hoac IP LAN rieng (192.168.x, 10.x, 172.16-31.x) bat ky port nao —
 * tu dong cho phep du doi wifi/mang nao, khong can sua CORS_ORIGIN moi lan. */
const PRIVATE_LAN_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin) || PRIVATE_LAN_ORIGIN_RE.test(origin)) {
        return callback(null, true);
      }
      callback(new Error('CORS_NOT_ALLOWED'));
    },
  }),
);
app.use((req, _res, next) => withRequestBaseUrl(`${req.protocol}://${req.get('host')}`, next));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(env.uploadDir)));
app.use(identify);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use(
  '/api',
  categoriesRouter,
  productsRouter,
  searchRouter,
  cartRouter,
  ordersRouter,
  reviewsRouter,
  shippingRouter,
  discountsRouter,
  uploadsRouter,
  statsRouter,
  employeesRouter,
  chatRouter,
);

app.use(notFoundHandler);
app.use(errorHandler);
