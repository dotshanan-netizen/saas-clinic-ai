const { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-R', '80:localhost:3000', 'nokey@localhost.run']);

child.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('STDOUT:', output);
  
  // Extract URL
  const match = output.match(/(https:\/\/[a-zA-Z0-9.-]+\.lhr\.life)/);
  if (match) {
    fs.writeFileSync('tunnel-url.txt', match[1]);
    console.log('Saved URL:', match[1]);
  }
});

child.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('STDERR:', output);
  
  // Extract URL (localhost.run sometimes prints to stderr)
  const match = output.match(/(https:\/\/[a-zA-Z0-9.-]+\.lhr\.life)/);
  if (match) {
    fs.writeFileSync('tunnel-url.txt', match[1]);
    console.log('Saved URL:', match[1]);
  }
});

child.on('close', (code) => {
  console.log(`SSH tunnel exited with code ${code}`);
});

// keep alive
setInterval(() => {}, 1000 * 60 * 60); // 1 hour
