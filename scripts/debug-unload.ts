import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(msg.text()));

  await page.addInitScript(() => {
    window.addEventListener('beforeunload', () => {
      console.log("[Before Unload Stack Trace]");
      try { throw new Error('Unload trace'); } catch(e: any) { console.log(e.stack); }
    });
  });

  console.log("Goto dashboard...");
  try {
    await page.goto('http://localhost:3000/dashboard');
  } catch(e) {}
  
  await page.waitForTimeout(5000);
  await browser.close();
}
run();

export {};
