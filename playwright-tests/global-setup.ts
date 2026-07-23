import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log(`[Global Setup] Performing login to ${baseURL}...`);
  
  const response = await page.request.post(`${baseURL}/api/auth/login`, {
    data: {
      email: "admin@rival.com",
      password: "clinova-admin-2026"
    }
  });
  
  if (!response.ok()) {
    throw new Error(`Global login failed: ${response.status()} ${await response.text()}`);
  }
  
  console.log("[Global Setup] Login successful! Saving state...");
  await context.storageState({ path: "playwright-tests/state.json" });
  await browser.close();
}

export default globalSetup;
