const { chromium } = require("playwright");

let homePage = process.env.GREYTHR_HOMEPAGE_URI;
if (homePage) homePage = homePage.split("/uas/")[0];

const employeeId = process.env.EMPLOYEE_ID;
const password = process.env.PASSWORD;
const action = process.env.ACTION || "signin";

console.log("--- Configuration ---");
console.log("Homepage:", homePage);
console.log("Employee ID:", employeeId);
console.log("Password set:", password ? "YES" : "NO");
console.log("Action:", action);
console.log("---------------------");

(async () => {
  let browser;
  try {
    console.log("Step 1: Opening browser...");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("Step 2: Going to GreytHR login page...");
    await page.goto(`${homePage}/uas/portal/auth/login`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    console.log("Step 2: SUCCESS");

    console.log("Step 3: Entering Employee ID...");
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.fill('input[name="username"]', employeeId);
    await page.fill('input[name="password"]', password);
    console.log("Step 3: SUCCESS");

    console.log("Step 4: Clicking Login...");
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 60000 }).catch(() => {}),
    ]);
    await page.waitForTimeout(5000);

    const currentUrl = page.url();
    console.log("Current URL:", currentUrl);
    if (currentUrl.includes("auth/login")) {
      throw new Error("Login failed! Wrong credentials.");
    }
    console.log("Step 4: SUCCESS - Logged in!");

    console.log(`Step 5: Marking ${action}...`);
    const attendanceAction = action === "signin" ? "Signin" : "SignOut";
    const result = await page.evaluate(async (homepage, attendanceAction) => {
      const res = await fetch(`${homepage}/v3/api/attendance/mark-attendance?action=${attendanceAction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      return { status: res.status, text: await res.text() };
    }, homePage, attendanceAction);

    console.log(`Step 5 response: ${result.status} ${result.text}`);

    if (result.status === 200) {
      const now = new Date();
      console.log(`✅ ${attendanceAction} marked successfully at ${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")} UTC`);
    } else {
      throw new Error(`Attendance failed: ${result.status} - ${result.text}`);
    }

    await browser.close();

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
