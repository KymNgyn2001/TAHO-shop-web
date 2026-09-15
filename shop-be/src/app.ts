import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './lib/env';
import { identify } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';

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

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      callback(new Error('CORS_NOT_ALLOWED'));
    },
  }),
);
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
