import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log(`[Navigation] URL changed to: ${frame.url()}`);
    }
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
