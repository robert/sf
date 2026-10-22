const { chromium } = require('playwright');
(async () => {
  const keys = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1.5 });
  for (const k of keys) {
    await p.goto('file://' + __dirname + '/render.html?k=' + k);
    await p.waitForTimeout(400);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: __dirname + '/out/' + k + '.jpg', type: 'jpeg', quality: 84 });
    console.log('ok', k);
  }
  await b.close();
})();
