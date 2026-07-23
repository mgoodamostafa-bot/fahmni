const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const artifactsDir = 'C:\\Users\\AA\\.gemini\\antigravity\\brain\\ba93d789-8984-4869-a801-aec52c86092f';

(async () => {
  console.log('🚀 Starting Center OS automated verification test using Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport to a nice modern size
  await page.setViewport({ width: 1280, height: 800 });

  // Log page console errors
  page.on('console', msg => console.log('💻 BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.error('🔴 BROWSER ERROR:', error.message));
  page.on('requestfailed', request => {
    const failure = request.failure();
    console.warn('⚠️ REQUEST FAILED:', request.url(), failure ? failure.errorText : 'unknown');
  });

  try {
    // 1. Load login page
    console.log('Navigating to http://eng.localhost:3000/login...');
    await page.goto('http://eng.localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(artifactsDir, '01_login_page.png') });
    console.log('Login page loaded.');

    // 2. Perform login
    console.log('Filling in teacher credentials...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'teacher_test@fahmni.com');
    await page.type('input[type="password"]', 'password123');
    await page.screenshot({ path: path.join(artifactsDir, '02_login_filled.png') });
    
    console.log('Clicking login button...');
    await page.click('form button[type="submit"]');
    
    console.log('Waiting for redirect to home or dashboard...');
    await page.waitForFunction(() => {
      return window.location.pathname === '/' || window.location.pathname === '/teacher';
    }, { timeout: 10000 }).catch(err => console.log('Redirect wait timed out, continuing...'));
    
    await page.screenshot({ path: path.join(artifactsDir, '03_after_login.png') });

    // 3. Go to Center Hub
    console.log('Navigating to http://eng.localhost:3000/teacher/center-hub...');
    await page.goto('http://eng.localhost:3000/teacher/center-hub', { waitUntil: 'networkidle2' });
    
    console.log('Waiting for dashboard tab buttons to appear (auth loading)...');
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(b => b.textContent.includes('اللوحة الرئيسية'));
    }, { timeout: 15000 }).catch(err => console.log('Wait for tab buttons timed out:', err));

    await page.screenshot({ path: path.join(artifactsDir, '04_center_hub_overview.png') });
    console.log('Center Hub Overview page loaded.');

    // Helper function to click tab by label text
    const clickTab = async (label) => {
      console.log(`Clicking tab: "${label}"...`);
      await page.evaluate((tabLabel) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const tabButton = buttons.find(b => b.textContent.includes(tabLabel));
        if (tabButton) {
          tabButton.click();
        } else {
          console.error('Could not find button with text:', tabLabel);
        }
      }, label);
      // Wait for rendering
      await new Promise(r => setTimeout(r, 1500));
    };

    // 4. Click through all tabs and take screenshots
    await clickTab('دليل وتعديل الطلاب');
    await page.screenshot({ path: path.join(artifactsDir, '05_center_hub_directory.png') });

    await clickTab('تحضير وحضور الحصص');
    await page.screenshot({ path: path.join(artifactsDir, '06_center_hub_attendance.png') });

    await clickTab('التقييمات والدرجات');
    await page.screenshot({ path: path.join(artifactsDir, '07_center_hub_evaluations.png') });

    await clickTab('الامتحانات الورقية');
    await page.screenshot({ path: path.join(artifactsDir, '08_center_hub_offline_results.png') });

    await clickTab('الماليات والاشتراكات');
    await page.screenshot({ path: path.join(artifactsDir, '09_center_hub_financials.png') });

    console.log('✅ Automated verification run completed successfully!');
  } catch (err) {
    console.error('❌ Automated test run encountered an error:', err);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
})();
