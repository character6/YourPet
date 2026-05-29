import { execSync } from 'child_process';

const port = process.argv[2] || '3001';

function freePort(targetPort) {
  try {
    const output = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
    const pids = new Set();

    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Port ${targetPort}: stopped process ${pid}`);
      } catch {
        // ignore
      }
    }

    if (pids.size === 0) {
      console.log(`Port ${targetPort} is free`);
    }
  } catch {
    console.log(`Port ${targetPort} is free`);
  }
}

freePort(port);
