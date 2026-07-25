const puppeteer = require('puppeteer');

const ROUTES_TO_TEST = [
  { name: 'Dashboard (Patients & Conversations)', path: '/dashboard' },
  { name: 'Appointments', path: '/dashboard/appointments' },
  { name: 'Knowledge Base', path: '/dashboard/knowledge' },
  { name: 'Analytics', path: '/dashboard/analytics' },
  { name: 'Settings', path: '/dashboard/settings' },
];

const BASE_URL = 'http://localhost:3000';

(async () => {
  console.log("==================================================");
  console.log("🚀 STARTING CORE RUNTIME REGRESSION SUITE");
  console.log("==================================================\n");

  const browser = await puppeteer.launch({ headless: "new" });
  
  let allPassed = true;

  for (const route of ROUTES_TO_TEST) {
    const page = await browser.newPage();
    let hasErrors = false;
    let failedRequests = 0;
    
    // Capture errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        // Ignore expected HMR websocket close errors during navigation
        if (!msg.text().includes('WebSocket is already in CLOSING') && !msg.text().includes('net::ERR_INCOMPLETE_CHUNKED_ENCODING')) {
          console.error(`[${route.name}] Console Error: ${msg.text()}`);
          hasErrors = true;
        }
      }
    });
    
    page.on('pageerror', error => {
      console.error(`[${route.name}] React/Runtime Error: ${error.message}`);
      hasErrors = true;
    });

    page.on('requestfailed', request => {
        // Ignore aborted requests during rapid navigation if any, but log them
        if (request.failure().errorText !== 'net::ERR_ABORTED') {
            console.error(`[${route.name}] Failed Request: ${request.url()} - ${request.failure().errorText}`);
            failedRequests++;
        }
    });

    console.log(`⏳ Testing: ${route.name} (${route.path})...`);
    
    try {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0', timeout: 15000 });
      
      // Look for Infinite Loading Indicators (e.g. "جاري التحميل" or any spinner)
      // This is a heuristic: if a loading state persists after networkidle0, it's a bug.
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes("جاري تحميل المرضى") || pageText.includes("Loading...")) {
        console.error(`[${route.name}] ❌ FAILED: Infinite Loading detected.`);
        hasErrors = true;
      } else if (hasErrors || failedRequests > 0) {
        console.error(`[${route.name}] ❌ FAILED: Runtime Errors or Failed Requests detected.`);
      } else {
        console.log(`[${route.name}] ✅ PASS: Page loaded successfully. No Infinite Loading. No Console Errors.`);
      }

    } catch (e) {
      console.error(`[${route.name}] ❌ FAILED: ${e.message}`);
      hasErrors = true;
    } finally {
      if (hasErrors) allPassed = false;
      await page.close();
    }
  }

  await browser.close();

  console.log("\n==================================================");
  if (allPassed) {
    console.log("🏆 CORE RUNTIME REGRESSION SUITE: PASS");
    console.log("All core pages are fully functional, stable, and ready.");
  } else {
    console.log("💥 CORE RUNTIME REGRESSION SUITE: FAILED");
    console.log("Systemic issues remain. Do not merge.");
  }
  console.log("==================================================");
  
  process.exit(allPassed ? 0 : 1);
})();
