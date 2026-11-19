import { openPage } from '../src/pipeline/chrome.ts';
import { setTimeout as delay } from 'node:timers/promises';
const [url, sel, out, tab, time] = process.argv.slice(2);
const page = await openPage(url, 1600, 900);
try {
  await delay(1500);
  await page.eval(`localStorage.setItem('sf.project','el-ultimo-turno'); localStorage.setItem('sf.sel', ${JSON.stringify(sel)}); location.reload(); 1`);
  await delay(5000);
  if (time) await page.eval(`(() => { const r = document.querySelector('.transport > input[type=range]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, ${JSON.stringify(time)}); r.dispatchEvent(new Event('input', { bubbles: true })); return 1; })()`);
  if (tab) await page.eval(`[...document.querySelectorAll('.tabs button')].find(b => b.textContent.startsWith(${JSON.stringify(tab)}))?.click(); 1`);
  await delay(2000);
  await page.screenshot(out);
  console.log('errors:', page.consoleErrors);
} finally { await page.close(); }
