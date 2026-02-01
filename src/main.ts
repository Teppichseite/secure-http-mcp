import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const configDir = process.env.SF_CONFIG;
  const port = parseInt(process.env.SF_PORT, 10) || 3000;

  if (!configDir) {
    console.error('Error: SF_CONFIG environment variable is required');
    console.error('Usage: SF_CONFIG=/path/to/config SF_PORT=3000 node dist/main');
    process.exit(1);
  }
  
  const app = await NestFactory.create(
    AppModule.forRoot({
      configDir,
    }),
  );
  await app.listen(port);
  console.log(`Secure HTTP MCP is running on http://localhost:${port}`);
  console.log(`Config directory: ${configDir}`);
}
bootstrap();
