const path = require("path");
const { spawn } = require("child_process");

const electronBinary = require("electron");
const mainEntry = path.join(__dirname, "main.cjs");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [mainEntry], {
  stdio: "inherit",
  windowsHide: false,
  env,
});

child.on("close", (code, signal) => {
  if (code === null) {
    console.error("electron exited with signal", signal);
    process.exit(1);
    return;
  }
  process.exit(code);
});

const forwardSignal = (signal) => {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
};

forwardSignal("SIGINT");
forwardSignal("SIGTERM");
