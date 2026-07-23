const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new"
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

  // Navigate to local server
  try {
    await page.goto('http://eng.localhost:3000/parent-center', {waitUntil: 'domcontentloaded'});
  } catch (err) {
    console.log('Nav failed, trying http://localhost:3000/parent-center');
    await page.goto('http://localhost:3000/parent-center', {waitUntil: 'domcontentloaded'});
  }
  
  // Set mock student in sessionStorage
  await page.evaluate(() => {
    sessionStorage.setItem('parent_portal_student_center', JSON.stringify({
      uid: 'mock_uid_123',
      displayName: 'أحمد محمد',
      studentId: '2026002',
      grade: 'sec-1',
      level: 'secondary',
      fatherPhone: '01012345678',
      motherPhone: '01012345678',
      studentPhone: '01012345678'
    }));
  });

  console.log('RELOADING PAGE WITH SESSION STORAGE SET...');
  try {
    await page.goto('http://eng.localhost:3000/parent-center', {waitUntil: 'networkidle0'});
  } catch (err) {
    await page.goto('http://localhost:3000/parent-center', {waitUntil: 'networkidle0'});
  }
  
  // Wait a bit to let async code execute
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
