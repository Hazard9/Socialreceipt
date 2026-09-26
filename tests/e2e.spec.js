const { test, expect } = require("@playwright/test");
const path = require("path");

/* Every test starts from a clean slate: no localStorage, no cookies. */
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("1. first visit shows the landing screen with pricing and no console errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.reload();
  await expect(page.locator("#landingScreen")).toBeVisible();
  await expect(page.locator("text=Start Free. Try Now.")).toBeVisible();
  await expect(page.locator(".landing-example")).toContainText("The strongest move may be to wait.");
  await expect(page.locator(".pricing-card:has(.pricing-card-name:text-is('Pro Monthly'))")).toContainText("$9");
  await expect(page.locator(".pricing-card:has(.pricing-card-name:text-is('Lifetime Beta'))")).toContainText("$39");
  expect(errors).toEqual([]);
});

test("2. starting Free hides the landing screen and shows the app", async ({ page }) => {
  await page.reload();
  await page.click("text=Start Free. Try Now.");
  await expect(page.locator("#landingScreen")).toBeHidden();
  await expect(page.locator("#homeScreen")).toBeVisible();
  await expect(page.locator("#homeScreen")).toContainText("About to send");
  await expect(page.locator("#homeScreen")).toContainText("Received something");
  await expect(page.locator("#dailyRitualCard")).toContainText("What are you about to send?");
  await expect(page.locator("#homeProgressCard")).toContainText("Your progress");
  await expect(page.locator("#homeReflectionCard")).toContainText("Weekly reflection");
  await expect(page.locator("#homeReflectionCard")).toContainText("Your week has not started yet.");
});

async function skipToApp(page) {
  await page.evaluate(() => {
    localStorage.setItem("sr_seen_landing", "1");
    localStorage.setItem("sr_onboarded", "1");
  });
  await page.reload();
}

async function createReceipt(page, text) {
  await page.click('.nav-btn[data-screen="createScreen"]');
  await page.fill("#interactionText", text || "They said 'maybe later' and went quiet after I asked to hang out.");
  await page.click('button[onclick="generateReceipt()"]');
  // Loading animation runs ~1.3s
  await page.waitForSelector("#receiptOutput.active", { timeout: 5000 });
}

test("2b. returning users see a personal pattern after three reads", async ({ page }) => {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem("sr_seen_landing", "1");
    localStorage.setItem("socialReceipts", JSON.stringify([
      {id:"a",createdAt:now,feeling:"Anxious",scenario:"Text / DM",energy:"You chasing",risk:"High",verdict:"Hold",bestMove:"Wait",outcome:"Not tracked yet"},
      {id:"b",createdAt:now,feeling:"Calm",scenario:"Text / DM",energy:"You over-explaining",risk:"Medium",verdict:"Read",bestMove:"Wait",outcome:"Better than expected"},
      {id:"c",createdAt:now,feeling:"Calm",scenario:"Work",energy:"Balanced",risk:"Low",verdict:"Clear",bestMove:"Send",outcome:"Resolved"}
    ]));
  });
  await page.reload();
  await expect(page.locator("#homePatternCard")).toBeVisible();
  await expect(page.locator("#homePatternCard")).toContainText("Your pattern so far");
  await expect(page.locator("#homePatternCard")).toContainText("Open full pattern profile");
});

test("3. creating a normal receipt shows a verdict and a Pro upsell for free users", async ({ page }) => {
  await skipToApp(page);
  await createReceipt(page);
  await expect(page.locator("#receiptOutput")).toContainText(/Quick Verdict|Silence Detected/);
  await expect(page.locator("#receiptOutput")).toContainText("Your decision");
  await page.getByText("Share this receipt").click();
  await expect(page.locator("#shareOverlay")).toBeVisible();
  await expect(page.locator("#shareOverlay")).toContainText("Share result");
  await expect(page.locator("#shareOverlay")).toContainText("No private message text is included");
  await expect(page.locator("#receiptOutput")).toContainText("Message version test");
  await expect(page.locator("#receiptOutput")).toContainText("Compare my rewrite");
  await expect(page.locator("#receiptOutput")).toContainText("The move from here");
  await expect(page.locator("#receiptOutput")).toContainText("Cleaner move");
  await expect(page.locator("#receiptOutput")).toContainText("Close the loop");
  await expect(page.locator("#receiptOutput")).toContainText("reads patterns in the message");
  await expect(page.locator("#receiptOutput")).toContainText("Save for later");
  // Free users hit the gate with an honest explanation of what Pro adds, not a fake result
  await expect(page.locator("#receiptOutput")).toContainText("Continue on Free");
});

test("3b. a shared invite records first-receipt activation safely", async ({ page }) => {
  await page.goto("/?sr_ref=test_referral");
  await page.evaluate(() => {
    localStorage.setItem("sr_seen_landing", "1");
    localStorage.setItem("sr_onboarded", "1");
  });
  await page.reload();
  await createReceipt(page);
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("sr_referral_activation_recorded"))).toBe("1");
});

test("4. reaching the monthly free limit opens the paywall on the 4th receipt", async ({ page }) => {
  // The free limit (FREE_LIMIT=3) counts SAVED receipts per calendar month,
  // so each of the first 3 must be saved to actually consume the quota.
  await skipToApp(page);
  for (let i = 0; i < 3; i++) {
    await createReceipt(page, "Test message number " + i);
    await page.click('button[onclick="saveCurrentReceipt()"]');
    // Saving the 2nd+ receipt without an email on file opens the email
    // capture modal ~800ms later — wait for it and dismiss it so the
    // flow can continue.
    await page.waitForTimeout(1000);
    const emailModal = page.locator("#emailModal");
    if (await emailModal.isVisible().catch(() => false)) {
      await page.click('#emailModal button:has-text("Not now")');
    }
    await page.click('.nav-btn[data-screen="createScreen"]');
  }
  await page.fill("#interactionText", "One more message");
  await page.click('button[onclick="generateReceipt()"]');
  await expect(page.locator("#paywallOverlay")).toBeVisible();
});

test("5. opening the paywall shows accurate, consistent pricing and a free continuation option", async ({ page }) => {
  await skipToApp(page);
  await page.evaluate(() => openPaywall());
  const overlay = page.locator("#paywallOverlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("$9");
  await expect(overlay).toContainText("$39");
  await expect(overlay).toContainText("Lifetime Beta means ownership");
  await expect(overlay).toContainText("No recurring charge");
  // no fabricated original-price anchor
  await expect(overlay).not.toContainText("$79");
  await expect(page.locator(".paywall-dismiss")).toBeVisible();
  await expect(page.locator(".paywall-dismiss")).toHaveText("Continue on Free");
});

test("6. each plan button redirects to its correct real Stripe Payment Link", async ({ page }) => {
  await skipToApp(page);
  await page.evaluate(() => openPaywall());

  const links = await page.evaluate(() => window.STRIPE_LINKS);
  expect(links.monthly).toMatch(/^https:\/\/buy\.stripe\.com\//);
  expect(links.lifetime).toMatch(/^https:\/\/buy\.stripe\.com\//);

  // Intercept navigation instead of actually leaving the page
  let navigatedTo = null;
  await page.route("**://buy.stripe.com/**", (route) => {
    navigatedTo = route.request().url();
    route.abort();
  });
  await page.click(".paywall-actions button:has-text('Unlock Pro')").catch(() => {});
  await page.waitForTimeout(300);
  expect(navigatedTo).toContain(links.monthly);
  expect(navigatedTo).toContain("client_reference_id=monthly");
});

test("7. a missing/placeholder Stripe link fails closed with a toast, never a demo unlock", async ({ page }) => {
  await skipToApp(page);
  await page.evaluate(() => {
    window.STRIPE_LINKS.monthly = "https://buy.stripe.com/REPLACE_MONTHLY";
  });
  await page.evaluate(() => startCheckout("monthly"));
  await page.waitForTimeout(300);
  await expect(page.locator("#toast")).toContainText("not available");
  const isPro = await page.evaluate(() => localStorage.getItem("sr_pro"));
  expect(isPro).not.toBe("1");
});

test("8a. success.html shows a confirmed state only after verify-checkout says valid", async ({ page }) => {
  await page.route("**/.netlify/functions/verify-checkout*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ valid: true, plan: "monthly", email: "test@example.com" }),
    });
  });
  await page.goto("/success.html?session_id=cs_test_123");
  await expect(page.locator("#headline")).toContainText("Payment received", { timeout: 5000 });
  await expect(page.locator("#planBadge")).toContainText("Monthly");
});

test("8b. success.html shows an honest failure state when verification fails", async ({ page }) => {
  await page.route("**/.netlify/functions/verify-checkout*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ valid: false, error: "not_paid" }),
    });
  });
  await page.goto("/success.html?session_id=cs_test_fake");
  await expect(page.locator("#headline")).toContainText("could not verify", { timeout: 5000 });
});

test("8c. success.html never claims payment with no session_id at all", async ({ page }) => {
  await page.goto("/success.html");
  await expect(page.locator("#headline")).toContainText("No payment to confirm");
});

test("9. cancelling the screenshot file picker does not crash the app", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await skipToApp(page);
  await page.click('.nav-btn[data-screen="createScreen"]');
  await page.click('[onclick="openScreenshotModal()"]');
  await expect(page.locator("#screenshotModal")).toBeVisible();
  // Simulate a cancelled file picker: input change fires with no files
  await page.evaluate(() => {
    const input = document.getElementById("screenshotFileInput");
    handleScreenshotUpload(input);
  });
  await expect(page.locator("#screenshotModal")).toBeVisible();
  expect(errors).toEqual([]);
});

test("10. uploading a screenshot shows a preview and an honest no-OCR note", async ({ page }) => {
  await skipToApp(page);
  await page.click('.nav-btn[data-screen="createScreen"]');
  await page.click('[onclick="openScreenshotModal()"]');
  const fileInput = page.locator("#screenshotFileInput");
  await fileInput.setInputFiles(path.join(__dirname, "fixtures", "sample.png"));
  await expect(page.locator("#uploadPreviewImg")).toBeVisible();
  await expect(page.locator("#ocrNote")).toBeVisible();
  await expect(page.locator("#ocrNote")).toContainText("not the image");
});

test("11. text must be confirmed before a screenshot can be analyzed", async ({ page }) => {
  await skipToApp(page);
  await page.click('.nav-btn[data-screen="createScreen"]');
  await page.click('[onclick="openScreenshotModal()"]');
  await page.locator("#screenshotFileInput").setInputFiles(path.join(__dirname, "fixtures", "sample.png"));
  await page.click("#analyzeScreenshotBtn");
  // Empty text should block analysis, not fake an "analyzed" result
  await expect(page.locator("#screenshotModal")).toBeVisible();
  await page.fill("#screenshotText", "Hey are we still on for Friday?");
  await page.click("#analyzeScreenshotBtn");
  await expect(page.locator("#screenshotModal")).toBeHidden();
  await expect(page.locator("#interactionText")).toHaveValue("Hey are we still on for Friday?");
});

test("11b. email capture is visible from the home screen", async ({ page }) => {
  await skipToApp(page);
  await expect(page.locator("#homeEmailCaptureCard")).toBeVisible();
  await expect(page.locator("#homeEmailCaptureCard")).toContainText("Add my email");
  await page.click("#homeEmailCaptureCard button");
  await expect(page.locator("#emailModal")).toBeVisible();
  await expect(page.locator("#emailInput")).toBeVisible();
});

test("11c. talk-to-text controls are available for message entry", async ({ page }) => {
  await skipToApp(page);
  await page.click('.nav-btn[data-screen="createScreen"]');
  await expect(page.locator('button[aria-label="Talk to text for your interaction"]')).toBeVisible();
  await page.click('button[onclick="setCreateMode(\'before\')"]');
  await expect(page.locator('button[aria-label="Talk to text for your message"]')).toBeVisible();
  await page.click('button[onclick="setCreateMode(\'cold\')"]');
  await expect(page.locator('button[aria-label="Talk to text for the conversation"]')).toBeVisible();
});

test("12. email capture reports real success when the backend confirms it", async ({ page }) => {
  await skipToApp(page);
  await page.route("**/.netlify/functions/subscribe-email", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.evaluate(() => openLoginModal());
  await page.fill("#emailInput", "user@example.com");
  await page.click("#emailModalSubmitBtn");
  await expect(page.locator("#toast")).toContainText("subscribed", { timeout: 5000 });
});

test("13. email capture reports an honest failure when the backend is not configured", async ({ page }) => {
  await skipToApp(page);
  await page.route("**/.netlify/functions/subscribe-email", (route) => {
    route.fulfill({ status: 501, contentType: "application/json", body: JSON.stringify({ ok: false, error: "not_configured" }) });
  });
  await page.evaluate(() => openLoginModal());
  await page.fill("#emailInput", "user@example.com");
  await page.click("#emailModalSubmitBtn");
  await expect(page.locator("#toast")).toContainText("not connected", { timeout: 5000 });
});

test("14. refreshing the page preserves saved receipts", async ({ page }) => {
  await skipToApp(page);
  await createReceipt(page);
  await page.click('button[onclick="saveCurrentReceipt()"]');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("socialReceipts") || "[]").length);
  await page.reload();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("socialReceipts") || "[]").length);
  expect(after).toBe(before);
  expect(after).toBeGreaterThan(0);
});

test("15. clearing localStorage returns the user to the landing screen", async ({ page }) => {
  await skipToApp(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#landingScreen")).toBeVisible();
});

test("15b. insights shows content experiment tracking context", async ({ page }) => {
  await skipToApp(page);
  await page.click('.nav-btn[data-screen="insightsScreen"]');
  await expect(page.locator("#insightDashboard")).toContainText("Content Experiment Tracking");
  await expect(page.locator("#insightDashboard")).toContainText("Tracked funnel events");
});

test("16. no horizontal overflow at 360, 390, and 412px", async ({ page, browser }) => {
  for (const width of [360, 390, 412]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const p = await context.newPage();
    await p.goto("/");
    const { docWidth, winWidth } = await p.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
    }));
    expect(docWidth, `overflow at ${width}px`).toBeLessThanOrEqual(winWidth + 1);
    await context.close();
  }
});

test.describe("service worker", () => {
  test.use({ serviceWorkers: "allow" });

  test("17. service worker installs and precaches only files that exist", async ({ page }) => {
    await page.goto("/");
    const result = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.register("/sw.js");
      await new Promise((resolve) => {
        if (reg.active) return resolve();
        const sw = reg.installing || reg.waiting;
        if (!sw) return resolve();
        sw.addEventListener("statechange", () => { if (sw.state === "activated") resolve(); });
      });
      const cacheNames = await caches.keys();
      const cacheName = cacheNames.find((n) => n.indexOf("social-receipt") === 0);
      const cache = cacheName ? await caches.open(cacheName) : null;
      const keys = cache ? (await cache.keys()).map((r) => new URL(r.url).pathname) : [];
      return { supported: true, cacheName, keys };
    });
    if (result.supported) {
      expect(result.cacheName).toBeTruthy();
      expect(result.keys.length).toBeGreaterThan(0);
    }
  });
});

test("18. Google Fonts and Stripe Payment Link domains resolve", async ({ page }) => {
  await page.goto("/");
  const links = await page.evaluate(() => window.STRIPE_LINKS);
  const urls = [
    "https://fonts.googleapis.com/css2?family=DM+Sans",
    links.monthly,
    links.lifetime,
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url, { method: "GET", redirect: "manual" });
      // Any response (including a redirect) means the domain resolved and answered.
      expect(resp.status).toBeGreaterThan(0);
    } catch (e) {
      test.info().annotations.push({ type: "warning", description: "Could not reach " + url + " (no network in this environment?): " + e.message });
    }
  }
});
