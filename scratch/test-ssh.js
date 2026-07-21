const { spawn } = require('child_process');
const child = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-R', '80:localhost:3000', 'nokey@localhost.run']);

child.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString().trim());
});

child.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString().trim());
});

child.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
});

setTimeout(() => {
  console.log("Stopping script after 10s...");
  child.kill();
  process.exit(0);
}, 10000);
