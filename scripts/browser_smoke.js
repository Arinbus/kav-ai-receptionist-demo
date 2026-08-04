#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:8765/";
const chromePath = process.env.CHROME_PATH || "/usr/bin/google-chrome";

function collectDiagnostics(page) {
  const errors = [];
  const failedRequests = [];
  const externalRequests = [];
  const allowedOrigin = new URL(baseUrl).origin;

  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", request => {
    failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`);
  });
  page.on("request", request => {
    const url = request.url();
    if (url.startsWith("data:")) return;
    if (new URL(url).origin !== allowedOrigin) externalRequests.push(url);
  });

  return { errors, failedRequests, externalRequests };
}

async function desktopFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "ru-RU" });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#demo").waitFor();
  assert.match(await page.title(), /KAV/);
  assert.equal(await page.locator("html").getAttribute("dir"), "ltr");

  const initialOverflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(initialOverflow.document <= initialOverflow.viewport + 1, `desktop horizontal overflow: ${JSON.stringify(initialOverflow)}`);

  await page.locator("#businessName").fill("QA Studio");
  await page.locator("#cityName").fill("Haifa");
  await page.locator("#pitchForm button[type=submit]").click();
  assert.equal(await page.locator("[data-business]").first().textContent(), "QA Studio");
  assert.match(await page.locator("#chatLog").textContent(), /QA Studio/);

  await page.locator('[data-choice="tomorrow"]').click();
  await page.locator('[data-choice="t1830"]').click();
  await page.locator('[data-choice="create"]').click();

  let state = await page.evaluate(() => window.__KAV_DEMO__.getState());
  assert.equal(state.leads[0].status, "new");
  assert.equal(state.leads[0].requestKey, "requestTomorrow1830");
  assert.equal(state.stage, null);
  assert.match(await page.locator("#ownerView").textContent(), /Новая заявка/);

  await page.locator('[data-owner-view="leads"]').click();
  assert.match(await page.locator("#ownerView").textContent(), /Завтра · 18:30/);
  assert.equal(await page.locator("#ownerView tbody tr").count(), 2);

  await page.locator('[data-owner-view="summary"]').click();
  assert.match(await page.locator(".summary-text").textContent(), /D-101/);
  assert.match(await page.locator(".not-client-metrics").textContent(), /не реальные показатели клиента/);

  await page.locator('[data-owner-view="inbox"]').click();
  await page.locator("#ownerPrimaryAction").click();
  state = await page.evaluate(() => window.__KAV_DEMO__.getState());
  assert.equal(state.leads[0].status, "owner");
  assert.equal(await page.locator("#ownerPrimaryAction").isDisabled(), true);
  assert.match(state.messages.at(-1).text, /Владелец подключился/);

  await page.locator('[data-lang="he"]').click();
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.equal(await page.locator("html").getAttribute("lang"), "he");
  assert.equal(await page.locator(".nav-links").getAttribute("aria-label"), "ניווט ראשי");
  assert.equal(await page.locator(".price-main").getAttribute("dir"), "ltr");

  await page.locator('[data-scenario="handoff"]').click();
  await page.locator('[data-choice="shoulder"]').click();
  await page.locator('[data-choice="today"]').click();
  await page.locator('[data-choice="handoff"]').click();

  state = await page.evaluate(() => window.__KAV_DEMO__.getState());
  assert.equal(state.scenario, "handoff");
  assert.equal(state.leads[1].status, "handoff");
  assert.equal(state.leads[1].detailKey, "detailShoulder");
  assert.equal(state.leads[1].requestKey, "requestToday1800");
  assert.match(await page.locator("#ownerPrimaryAction").textContent(), /לקחת שיחה/);

  await page.locator("#ownerPrimaryAction").click();
  state = await page.evaluate(() => window.__KAV_DEMO__.getState());
  assert.equal(state.leads[1].status, "owner");

  const offer = await page.evaluate(() => window.__KAV_DEMO__.getOffer());
  const summary = await page.evaluate(() => window.__KAV_DEMO__.getSummary());
  assert.match(offer, /₪2,500–5,000/);
  assert.match(offer, /QA Studio/);
  assert.match(summary, /QA Studio/);

  assert.deepEqual(diagnostics.errors, [], `browser errors: ${diagnostics.errors.join(" | ")}`);
  assert.deepEqual(diagnostics.failedRequests, [], `failed requests: ${diagnostics.failedRequests.join(" | ")}`);
  assert.deepEqual(diagnostics.externalRequests, [], `external requests: ${diagnostics.externalRequests.join(" | ")}`);

  await context.close();
  return {
    viewport: "1440x1000",
    booking: "PASS",
    ownerTabs: "PASS",
    ownerAction: "PASS",
    hebrewRtl: "PASS",
    handoff: "PASS",
    consoleErrors: 0,
    failedRequests: 0,
    externalRequests: 0,
  };
}

async function mobileFlow(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);

  await page.goto(`${baseUrl.replace(/\/$/, "")}/#demo`, { waitUntil: "networkidle" });
  await page.locator("#demo").waitFor();

  const metrics = await page.evaluate(() => {
    const selectors = [
      ".lang-button",
      ".scenario-button",
      ".reset-button",
      ".quick-button",
      ".send-button",
      ".owner-tab",
    ];
    const targets = selectors.flatMap(selector =>
      [...document.querySelectorAll(selector)].map(element => ({
        selector,
        text: element.textContent?.trim() || element.getAttribute("aria-label") || "",
        height: Math.round(element.getBoundingClientRect().height * 10) / 10,
      }))
    );
    const client = document.querySelector(".client-side").getBoundingClientRect();
    const owner = document.querySelector(".owner-side").getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      workspaceColumns: getComputedStyle(document.querySelector(".workspace")).gridTemplateColumns,
      ownerBelowClient: owner.top >= client.bottom - 1,
      targets,
    };
  });

  assert.equal(metrics.viewport, 390);
  assert.ok(metrics.document <= metrics.viewport + 1, `mobile horizontal overflow: ${JSON.stringify(metrics)}`);
  assert.equal(metrics.ownerBelowClient, true, "owner panel must stack below client chat on mobile");
  const undersized = metrics.targets.filter(target => target.height < 44);
  assert.deepEqual(undersized, [], `mobile targets below 44px: ${JSON.stringify(undersized)}`);

  assert.deepEqual(diagnostics.errors, [], `mobile browser errors: ${diagnostics.errors.join(" | ")}`);
  assert.deepEqual(diagnostics.failedRequests, [], `mobile failed requests: ${diagnostics.failedRequests.join(" | ")}`);
  assert.deepEqual(diagnostics.externalRequests, [], `mobile external requests: ${diagnostics.externalRequests.join(" | ")}`);

  await context.close();
  return {
    viewport: "390x844 touch",
    horizontalOverflow: false,
    stackedWorkspace: true,
    minimumTouchTarget: `${Math.min(...metrics.targets.map(target => target.height))}px`,
    consoleErrors: 0,
    failedRequests: 0,
    externalRequests: 0,
  };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const desktop = await desktopFlow(browser);
    const mobile = await mobileFlow(browser);
    console.log(JSON.stringify({ result: "PASS", desktop, mobile }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
