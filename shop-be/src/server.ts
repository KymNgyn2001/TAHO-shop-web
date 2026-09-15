import { app } from './app';
import { env } from './lib/env';

app.listen(env.port, () => {
  console.log(`shop-be dang chay tai http://localhost:${env.port}`);
});
