const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting Browser Forensic Investigation...");
  const browser = await puppeteer.launch({ 
    headless: "new",
    
  });
  const page = await browser.newPage();

  // Capture all console logs
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()} ${msg.text()}`));
  
  // Capture unhandled page errors
  page.on('pageerror', error => console.log(`[PAGE ERROR] ${error.message}`));
  
  // Capture failed requests
  page.on('requestfailed', request => {
    console.log(`[NETWORK FAIL] ${request.url()} - ${request.failure().errorText}`);
  });

  // Capture all network responses to see API payloads and HTTP status
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    // Only care about API calls
    if (url.includes('/api/')) {
      let body = '';
      try {
        body = await response.text();
      } catch (e) {
        body = '[Could not read body]';
      }
      console.log(`[API RESPONSE] ${status} - ${url}\n[PAYLOAD] ${body.substring(0, 200)}`);
    }
  });

  try {
    console.log("Navigating to Dashboard...");
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2', timeout: 10000 });
    
    console.log("Waiting 5 seconds to observe behavior...");
    await new Promise(r => setTimeout(r, 5000));
    
    // Evaluate if loading state exists
    const loadingText = await page.evaluate(() => {
      return document.body.innerText.includes("جاري تحميل المرضى") ? "Loading stuck on screen" : "Loading cleared";
    });
    console.log(`[UI STATE] ${loadingText}`);

  } catch (err) {
    console.error("Puppeteer Script Error:", err);
  } finally {
    await browser.close();
    console.log("Investigation Complete.");
  }
})();
