require('dotenv').config();
const puppeteer = require('puppeteer');

async function postToLinkedIn(content) {
  let browser;

  try {
    console.log('🚀 Starting LinkedIn automation...');

    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=site-per-process',
        '--start-maximized'
      ]
    });

    const page = await browser.newPage();

    // Set longer timeout for all operations
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Set user agent and other headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Step 1: Navigate to LinkedIn with retry logic
    console.log('🔄 Navigating to LinkedIn login...');
    let loginSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!loginSuccess && attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`🔄 Login attempt ${attempts}/${maxAttempts}`);

        await page.goto('https://www.linkedin.com/login', {
          waitUntil: 'domcontentloaded',
          timeout: 45000
        });

        // Wait for page to be interactive
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });

        loginSuccess = true;
      } catch (error) {
        console.log(`⚠️ Login page load attempt ${attempts} failed: ${error.message}`);
        if (attempts === maxAttempts) {
          throw new Error(`Failed to load LinkedIn login page after ${maxAttempts} attempts`);
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Step 2: Fill login form with better error handling
    console.log('🔄 Filling login credentials...');

    try {
      // Wait for username field with multiple selectors
      const usernameSelectors = ['#username', 'input[name="session_key"]', 'input[autocomplete="username"]'];
      let usernameField = null;

      for (const selector of usernameSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          usernameField = await page.$(selector);
          if (usernameField) break;
        } catch (e) {
          continue;
        }
      }

      if (!usernameField) {
        throw new Error('Could not find username field');
      }

      await usernameField.click();
      await usernameField.type(process.env.LINKEDIN_EMAIL, { delay: 100 });

      // Wait for password field
      const passwordSelectors = ['#password', 'input[name="session_password"]', 'input[type="password"]'];
      let passwordField = null;

      for (const selector of passwordSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          passwordField = await page.$(selector);
          if (passwordField) break;
        } catch (e) {
          continue;
        }
      }

      if (!passwordField) {
        throw new Error('Could not find password field');
      }

      await passwordField.click();
      await passwordField.type(process.env.LINKEDIN_PASSWORD, { delay: 100 });

    } catch (error) {
      throw new Error(`Login form filling failed: ${error.message}`);
    }

    // Step 3: Submit login with navigation handling
    console.log('🔄 Submitting login...');

    try {
      const submitSelectors = ['[type="submit"]', 'button[data-litms-control-urn]', '.btn__primary--large'];
      let submitButton = null;

      for (const selector of submitSelectors) {
        try {
          submitButton = await page.$(selector);
          if (submitButton) break;
        } catch (e) {
          continue;
        }
      }

      if (!submitButton) {
        throw new Error('Could not find submit button');
      }

      // Click submit and handle navigation with timeout
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
        submitButton.click()
      ]);

      // Additional wait for page to settle
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if we're still on login page (login failed)
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/challenge')) {
        throw new Error('Login appears to have failed or requires additional verification');
      }

    } catch (error) {
      if (error.message.includes('Navigation timeout')) {
        console.log('⚠️ Navigation timeout occurred, checking current page...');
        // Sometimes navigation "fails" but we're actually logged in
        const currentUrl = page.url();
        if (!currentUrl.includes('/login')) {
          console.log('✅ Login appears successful despite timeout');
        } else {
          throw new Error('Login navigation failed');
        }
      } else {
        throw error;
      }
    }

    // Step 4: Navigate to feed with better handling
    console.log('🔄 Navigating to feed...');

    try {
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });

      // Wait for feed elements to appear
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      if (error.message.includes('timeout')) {
        console.log('⚠️ Feed navigation timeout, trying alternative approach...');
        try {
          const homeLinks = await page.$$('a[href*="/feed"], a[href="/"], .global-nav__primary-link');
          if (homeLinks.length > 0) {
            await homeLinks[0].click();
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        } catch (altError) {
          throw new Error('Could not navigate to feed');
        }
      } else {
        throw error;
      }
    }

    // Step 5: Find and click "Start a post" button with improved selectors
    console.log('🔄 Looking for post creation button...');

    const postButtonSelectors = [
      'button[aria-label*="Start a post"]',
      'button[data-test-id="share-box-trigger"]',
      '.share-box-feed-entry__trigger',
      '[data-control-name="share_to_feed"]',
      'button:has-text("Start a post")',
      '.artdeco-button--secondary',
      '.share-box-feed-entry__closed-share-box',
      'button[data-test-id*="share"]'
    ];

    let postButton = null;
    let foundSelector = '';

    // Try multiple approaches to find the post button
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`🔄 Post button search attempt ${attempt + 1}/3`);
      
      for (const selector of postButtonSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          const buttons = await page.$$(selector);
          
          for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', btn);
            const isVisible = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && 
                     window.getComputedStyle(el).visibility !== 'hidden' &&
                     window.getComputedStyle(el).display !== 'none';
            }, btn);
            
            if (isVisible && (text.toLowerCase().includes('start') || text.toLowerCase().includes('post') || text.toLowerCase().includes('share'))) {
              postButton = btn;
              foundSelector = selector;
              break;
            }
          }
          if (postButton) break;
        } catch (e) {
          continue;
        }
      }

      if (postButton) break;

      // If not found, try scrolling and waiting
      console.log('🔄 Scrolling to find post button...');
      await page.evaluate(() => window.scrollTo(0, 300));
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!postButton) {
      // Last resort: try to find any clickable element that might open post modal
      console.log('🔄 Trying alternative approach...');
      const alternativeSelectors = [
        'div.share-box-feed-entry',
        '.share-box-feed-entry__closed-share-box',
        '[data-test-id*="share-box"]'
      ];

      for (const selector of alternativeSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            postButton = element;
            foundSelector = selector;
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!postButton) {
      throw new Error('Could not find "Start a post" button after multiple attempts');
    }

    console.log(`✅ Found post button with selector: ${foundSelector}`);
    await postButton.click();
    console.log('✅ Clicked post creation button');

    // Step 6: Wait for and find the editor with improved detection
    console.log('🔄 Waiting for post editor...');

    // Wait a bit for any animation/modal to appear
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try multiple approaches to detect the editor
    const editorSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"]',
      '.ql-editor',
      '.editor-content',
      '[data-placeholder*="post"]',
      '.share-creation-state__text-editor',
      'div[data-test-id="share-box-text-editor"]'
    ];

    let editor = null;
    let editorFound = false;

    // Try to find editor with multiple attempts
    for (let attempt = 0; attempt < 10; attempt++) {
      console.log(`🔄 Looking for editor (attempt ${attempt + 1}/10)...`);

      for (const selector of editorSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const isVisible = await page.evaluate(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0 && 
                     window.getComputedStyle(el).visibility !== 'hidden' &&
                     window.getComputedStyle(el).display !== 'none';
            }, element);
            
            if (isVisible) {
              editor = element;
              editorFound = true;
              break;
            }
          }
          if (editorFound) break;
        } catch (e) {
          continue;
        }
      }

      if (editorFound) break;

      // Wait and try again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!editor) {
      // Check if we might be in a different type of post interface
      console.log('🔄 Checking for alternative post interfaces...');
      
      // Look for any text input areas
      const textInputs = await page.$$('textarea, input[type="text"], div[contenteditable="true"]');
      for (const input of textInputs) {
        const placeholder = await page.evaluate(el => 
          el.placeholder || el.getAttribute('data-placeholder') || el.getAttribute('aria-label') || '', input);
        
        if (placeholder.toLowerCase().includes('post') || 
            placeholder.toLowerCase().includes('share') || 
            placeholder.toLowerCase().includes('what')) {
          editor = input;
          editorFound = true;
          break;
        }
      }
    }

    if (!editor) {
      throw new Error('❌ Could not find post editor after multiple attempts');
    }

    console.log('✅ Found post editor. Typing content...');
    
    // Click on editor to focus
    await editor.click();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Clear any existing content
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    // Type new content
    await editor.type(content, { delay: 50 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✅ Content typed successfully');

    // Step 7: Submit the post with improved button detection
    console.log('🔄 Looking for submit button...');

    let submitButton = null;
    let submitAttempts = 0;
    const maxSubmitAttempts = 15;

    while (!submitButton && submitAttempts < maxSubmitAttempts) {
      submitAttempts++;

      // Try multiple ways to find the Post button
      const submitSelectors = [
        "button[data-test-id='share-actions-primary-button']",
        "button[aria-label*='Post']",
        "button:has-text('Post')",
        ".share-actions__primary-action",
        "button[data-control-name='share.post']"
      ];

      for (const selector of submitSelectors) {
        try {
          const buttons = await page.$$(selector);
          for (const btn of buttons) {
            const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', btn);
            const isEnabled = await page.evaluate(el => 
              !el.disabled && 
              !el.hasAttribute('aria-disabled') && 
              !el.classList.contains('disabled'), btn);
            
            if (text.toLowerCase().includes('post') && 
                !text.toLowerCase().includes('repost') && 
                isEnabled) {
              submitButton = btn;
              break;
            }
          }
          if (submitButton) break;
        } catch (e) {
          continue;
        }
      }

      // Also try XPath approach
      if (!submitButton) {
        try {
          const buttons = await page.$x("//button[contains(text(), 'Post') and not(contains(text(), 'Repost'))]");
          if (buttons.length > 0) {
            const isEnabled = await buttons[0].evaluate(btn => 
              !btn.disabled && 
              !btn.hasAttribute('aria-disabled') && 
              !btn.classList.contains('disabled'));
            if (isEnabled) {
              submitButton = buttons[0];
            }
          }
        } catch (e) {
          // Continue trying
        }
      }

      if (submitButton) break;

      console.log(`⏳ Waiting for Post button to be available... (attempt ${submitAttempts}/${maxSubmitAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!submitButton) {
      throw new Error('Post button not found or not enabled after waiting');
    }

    console.log('✅ Found enabled Post button');
    await submitButton.click();
    console.log("✅ Post submitted successfully!");

    // Wait to see the result
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify post was submitted by checking for success indicators
    try {
      const successIndicators = [
        '.Toasts',
        '[data-test-id="toast"]',
        '.artdeco-toast'
      ];

      for (const selector of successIndicators) {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => el.textContent, element);
          if (text && text.toLowerCase().includes('post')) {
            console.log('✅ Post confirmation detected');
            break;
          }
        }
      }
    } catch (e) {
      // Success verification is optional
    }

  } catch (error) {
    console.error('❌ Error occurred:', error.message);

    // Take screenshot for debugging
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          await pages[0].screenshot({
            path: `linkedin-error-${Date.now()}.png`,
            fullPage: true
          });
          console.log('📸 Debug screenshot saved');
        }
      } catch (screenshotError) {
        console.error('Could not take screenshot:', screenshotError.message);
      }
    }

    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function to test with retry logic
async function postToLinkedInWithRetry(content, maxRetries = 2) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries}`);
      await postToLinkedIn(content);
      console.log('✅ Successfully posted to LinkedIn!');
      return;
    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        console.log(`⏳ Waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  throw lastError;
}

module.exports = {
  postToLinkedIn,
  postToLinkedInWithRetry
};