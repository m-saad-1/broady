const { spawn } = require("child_process");
const path = require("path");

const cwd = path.resolve(__dirname, "..");
const child = spawn("npm", ["run", "dev:api"], {
  cwd,
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    PRISMA_SKIP_VALIDATION_WARNING: "true",
    NODE_ENV: "development",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
