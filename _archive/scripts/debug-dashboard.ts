import { chromium } from 'playwright';

async function debugDashboard() {
  console.log("Starting Dashboard Debugger...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let networkRequests = 0;
  let apiRequests = 0;
  let consoleErrors = 0;
  let reactErrors = 0;

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${text}`);
      consoleErrors++;
    } else if (text.includes('🚀') || text.includes('🛑')) {
      console.log(`[Browser Info] ${text}`);
    } else if (msg.type() === 'warning') {
      console.log(`[Browser Console Warning] ${text}`);
    }
  });

  page.on('pageerror', error => {
    console.log(`[Page Error / Uncaught Exception] ${error.message}`);
    reactErrors++;
  });

  page.on('request', request => {
    networkRequests++;
    const url = request.url();
    if (url.includes('/api/')) {
      apiRequests++;
      console.log(`[Network API Request] ${request.method()} ${url}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      console.log(`[Network API Response] ${response.status()} ${url}`);
    }
  });

  await page.addInitScript(() => {
    const originalAssign = window.location.assign;
    window.location.assign = function(url) {
      console.log(`[NAV-INTERCEPT] window.location.assign("${url}") called!`);
      console.error("Assign Stack Trace:", new Error().stack);
      return originalAssign.apply(this, arguments as any);
    };
    
    // Monkey patch Next.js router if needed, but Next.js usually uses pushState.
    // Let's also patch setTimeout to see if there is an infinite loop of fetching!
    
  });

  console.log("Navigating to http://localhost:3000/dashboard...");
  
  try {
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    console.log("Page loaded and network idle.");
  } catch (err) {
    console.log("[Navigation Error]", err);
  }

  // Wait for 5 seconds to observe if any polling or loops happen
  console.log("Observing dashboard for 5 seconds...");
  await page.waitForTimeout(5000);
  
  console.log("\n=== Debug Summary ===");
  console.log(`Total Network Requests: ${networkRequests}`);
  console.log(`API Requests: ${apiRequests}`);
  console.log(`Console Errors: ${consoleErrors}`);
  console.log(`React Page Errors: ${reactErrors}`);
  
  if (apiRequests > 5) {
    console.log("⚠️ POTENTIAL LOOP DETECTED: Too many API requests in 5 seconds!");
  } else if (reactErrors > 0 || consoleErrors > 0) {
    console.log("⚠️ REACT/HYDRATION ERROR DETECTED: Check the console output.");
  } else {
    console.log("✅ DASHBOARD IS STABLE: No infinite loops or errors detected in the client.");
  }

  await browser.close();
}

debugDashboard();

export {};
