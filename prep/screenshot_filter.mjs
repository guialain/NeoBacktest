import puppeteer from "puppeteer";
const OUT = process.argv[2] || "/tmp/filter.png";
const b = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await b.newPage();
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await page.goto("http://localhost:5173", { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => { const run = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Run")); run && run.click(); });
await new Promise((r) => setTimeout(r, 5000));
// clique la ligne profil "range buy"
await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".cat tbody tr")];
  const r = rows.find((tr) => tr.textContent.includes("range buy"));
  r && r.click();
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: OUT, fullPage: true });
await b.close();
console.log("screenshot ->", OUT);
