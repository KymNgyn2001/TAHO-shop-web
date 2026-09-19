import { app } from './app';
import { env } from './lib/env';
import { bootstrapAdmin } from './lib/bootstrapAdmin';

app.listen(env.port, () => {
  console.log(`shop-be dang chay tai http://localhost:${env.port}`);
  void bootstrapAdmin();
});
