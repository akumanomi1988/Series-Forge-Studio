/** Samples nvidia-smi (if present) and writes CSV lines: time, gpu util %, memory used MiB. Ctrl+C / kill to stop.
 *   node scripts/gpu-monitor.ts <out.csv> [intervalSec=15] */
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
const [out, every = '15'] = process.argv.slice(2);
writeFileSync(out, 'iso,gpuUtilPct,memUsedMiB,memTotalMiB\n');
for (;;) {
  const r = spawnSync('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8', windowsHide: true });
  if (r.status === 0) appendFileSync(out, `${new Date().toISOString()},${r.stdout.trim().split('\n')[0].replace(/\s/g, '')}\n`);
  await new Promise(ok => setTimeout(ok, Number(every) * 1000));
}
