const { spawn } = require("child_process");
const path = require("path");

const cwd = path.resolve(__dirname, "..");
const child = spawn("npm", ["run", "dev:web"], {
  cwd,
  shell: true,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
