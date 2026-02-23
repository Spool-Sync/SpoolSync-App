// Prusa Connect login automation using browserless (Puppeteer)
import fetch from "node-fetch";

export async function loginPrusaConnect({
  email,
  password,
  otp,
  browserlessUrl,
}) {
  // This is a simplified example. In production, handle errors, 2FA, and token extraction robustly.
  const script = `
    const puppeteer = require('puppeteer');
    (async () => {
      const browser = await puppeteer.connect({ browserWSEndpoint: process.env.BROWSERLESS_URL });
      const page = await browser.newPage();
      await page.goto('https://connect.prusa3d.com/login');
      await page.type('input[type=email]', '${email}');
      await page.type('input[type=password]', '${password}');
      await page.click('button[type=submit]');
      await page.waitForNavigation();
      // If 2FA is required, handle it
      if (${otp ? "true" : "false"}) {
        await page.type('input[name=otp]', '${otp}');
        await page.click('button[type=submit]');
        await page.waitForNavigation();
      }
      // Extract JWT from cookies or localStorage
      const token = await page.evaluate(() => {
        return localStorage.getItem('access_token') || '';
      });
      await browser.close();
      return token;
    })();
  `;

  const res = await fetch(`${browserlessUrl}/function`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: script }),
  });
  const data = await res.json();
  if (!data.result) throw new Error("Failed to retrieve JWT");
  return data.result;
}
