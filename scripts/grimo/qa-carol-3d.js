// Run with: playwright-cli --session carol3d run-code --filename scripts/grimo/qa-carol-3d.js
// Isolated browser only; no task/plant/storage writes. Artifacts are gitignored.
// The CLI evaluates this file as a callback expression, not a Node module.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
async (page) => {
  const stage = page.locator('.carol3d-stage');
  const results = [];
  const check = (name, value) => { if (!value) throw new Error(name); results.push(name); };
  const attr = name => stage.getAttribute('data-' + name);
  const button = name => page.getByRole('button', { name, exact: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/plant/carol-3d');
  await stage.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.carol3d-stage')?.dataset.ready === 'true');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'output/playwright/carol-3d-390.png' });
  check('cloud care is retired', await page.getByRole('button', { name: /雲をとかす/ }).count() === 0);
  // The visible pink rear tuft is deliberately a distinct touch area. Its
  // screen-relative location is stable under the authored orthographic view.
  await page.mouse.move(25, 430);
  await page.mouse.down();
  await page.waitForTimeout(180);
  check('tail touch has a distinct startle', await attr('reaction') === 'tail' && await attr('part') === 'Tail' && await attr('tail-startle') === 'true');
  check('tail startle emotion mark appears', await page.locator('.carol3d-tail-startle svg').count() === 1);
  await page.screenshot({ path: 'output/playwright/carol-3d-tail.png' });
  await page.mouse.up();
  await page.waitForTimeout(1050);
  check('tail startle emotion mark settles', await attr('tail-startle') === 'false' && await page.locator('.carol3d-tail-startle').count() === 0);
  await button('なでる').click();
  await page.waitForTimeout(450);
  check('pet shows happy face', await attr('expression') === 'happy');
  await page.screenshot({ path: 'output/playwright/carol-3d-happy.png' });
  await button('つつく').click();
  await page.waitForTimeout(250);
  check('poke interrupts pet', await attr('expression') === 'surprised');
  await page.screenshot({ path: 'output/playwright/carol-3d-poke.png' });
  await page.mouse.move(240, 420);
  await page.mouse.down();
  check('direct mesh contact', await attr('contact') === 'true');
  await page.waitForTimeout(650);
  check('stationary hold', await attr('reaction') === 'hold');
  await page.mouse.up();
  check('release preserves hold and clears contact', await attr('reaction') === 'hold' && await attr('contact') === 'false');
  await page.mouse.move(215, 410);
  await page.mouse.down();
  for (let i=1; i<=12; i++) {
    await page.mouse.move(215+i*3, 410-Math.sin(i*.3)*5);
    await page.waitForTimeout(40);
  }
  check('continuous stroke is pet, not hold', await attr('reaction') === 'pet');
  await page.mouse.up();
  check('release preserves pet', await attr('reaction') === 'pet');
  await page.mouse.move(240, 420);
  await page.mouse.down();
  await stage.dispatchEvent('pointercancel', { pointerId: 1, button: 0 });
  await page.mouse.up();
  check('pointercancel clears contact without poke', await attr('contact') === 'false' && await attr('reaction') === 'touch');
  await page.mouse.down();
  await stage.evaluate(el => { if (el.hasPointerCapture(1)) el.releasePointerCapture(1); });
  await page.waitForTimeout(60);
  await page.mouse.up();
  check('lost capture clears contact', await attr('contact') === 'false');
  const beforeYaw = await attr('camera-yaw');
  await page.mouse.move(35, 180);
  await page.mouse.down();
  await page.mouse.move(120, 190, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(70);
  check('background rotates camera', await attr('camera-yaw') !== beforeYaw && await attr('contact') === 'false');
  await button('正面へ').click();
  await stage.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(40);
  check('keyboard camera', await attr('camera-yaw') !== '-0.320');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  check('keyboard touch alternative', await attr('reaction') === 'poke');
  check('walking is retired', await attr('walking') === 'false' && await page.getByRole('button', { name: '歩いてみて', exact: true }).count() === 0);
  await page.waitForTimeout(1500);
  await button('マカロンをあげる（チェック用）').click();
  await page.waitForTimeout(350);
  check('feeding isolates the performance', await attr('feeding') === 'true' && await attr('performance') === 'valid');
  check('feeding disables competing touch actions', await button('なでる').isDisabled() && await button('つつく').isDisabled() && await button('そっと押す').isDisabled());
  await page.getByRole('button', { name: 'キャロルが食べています…', exact: true }).evaluate(element => { element.click(); element.click(); });
  check('feeding remains single flight', await attr('feed-count') === '1');
  await page.waitForTimeout(1950);
  check('Lucide heart burst appears', await page.locator('.carol3d-hearts svg').count() === 5 && await attr('performance') === 'valid');
  await page.waitForTimeout(2300);
  check('feeding finishes cleanly', await attr('feeding') === 'false' && await attr('performance') === 'valid' && await page.locator('.carol3d-hearts').count() === 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await button('なでる').click();
  await page.waitForTimeout(60);
  check('reduced motion retains expression', await attr('reduced-motion') === 'true' && await attr('expression') === 'happy');
  await page.screenshot({ path: 'output/playwright/carol-3d-reduced.png' });
  await page.waitForTimeout(2250);
  check('reduced motion settles', await attr('expression') === 'neutral');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await button('正面へ').click();
  for (const [width, height] of [[320,740], [1280,800]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    check('no horizontal overflow at '+width, await page.evaluate(() => document.documentElement.scrollWidth === innerWidth));
    check('controls fit at '+width, await button('近づく').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight));
    await page.screenshot({ path: 'output/playwright/carol-3d-'+width+'.png' });
  }
  return { passed: results, drawCalls: await attr('draw-calls'), triangles: await attr('triangles') };
}
