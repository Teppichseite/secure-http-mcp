"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const configDir = process.env.SHM_CONFIG;
    const port = parseInt(process.env.SHM_PORT || "3000", 10) || 3000;
    if (!configDir) {
        console.error("Error: SHM_CONFIG environment variable is required");
        console.error("Usage: SHM_CONFIG=/path/to/config SHM_PORT=3000 node dist/main");
        process.exit(1);
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule.forRoot({
        configDir,
    }));
    await app.listen(port);
    console.log(`Secure HTTP MCP is running on http://localhost:${port}`);
    console.log(`Config directory: ${configDir}`);
}
bootstrap();
