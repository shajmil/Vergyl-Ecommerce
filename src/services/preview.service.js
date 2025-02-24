const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const NodeCache = require('node-cache');

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

// Increased cache with better memory management
const previewCache = new NodeCache({ 
    stdTTL: 86400,
    checkperiod: 3600,
    maxKeys: 1000 
});

// Reusable browser instance
let browserInstance = null;

// Enhanced browser configuration
const launchOptions = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-extensions',
        '--disable-audio-output',
        '--disable-remote-fonts',
        '--disable-background-networking',
        '--disable-default-apps',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--enable-features=NetworkService',
        '--no-first-run',
        '--no-service-autorun',
        '--password-store=basic'
    ],
    ignoreHTTPSErrors: true
};

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch(launchOptions);
    }
    return browserInstance;
}

const fetchWithFallback = async(url) => {
    const cachedData = previewCache.get(url);
    if (cachedData) return cachedData;

    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let page = null;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            
            // Filter console messages
            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('net::ERR_FAILED') || 
                    text.includes('preloaded using link preload') ||
                    text.includes('Failed to load resource')) {
                    return;
                }
                console.log('Browser console:', text);
            });

            const navigationTimeout = attempt === 1 ? 30000 : 45000;
            await page.setDefaultNavigationTimeout(navigationTimeout);

            // Basic setup for all sites
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'sec-fetch-site': 'none',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document'
            });

            // Setup request interception
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                const url = request.url().toLowerCase();
                
                if (['media', 'font', 'websocket', 'manifest', 'other'].includes(resourceType) ||
                    url.includes('analytics') || 
                    url.includes('tracking') || 
                    url.includes('metrics') ||
                    url.includes('advertisement')) {
                    request.abort();
                    return;
                }
                
                if (resourceType === 'document' ||
                    resourceType === 'image' ||
                    resourceType === 'script') {
                    request.continue();
                    return;
                }
                
                request.abort();
            });

            // Navigate to page
            const response = await page.goto(url, {
                waitUntil: ['domcontentloaded', 'networkidle0'],
                timeout: navigationTimeout
            });

            // Accept both OK and Not Modified responses
            if (!response || (!response.ok() && response.status() !== 304)) {
                throw new Error(`Invalid response: ${response?.status() || 'no response'}`);
            }

            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Extract content using generic selectors
            const { content, image, title, description } = await page.evaluate(() => {
                const getMetaContent = (selectors) => {
                    for (const selector of selectors) {
                        try {
                            const element = document.querySelector(selector);
                            if (element) {
                                const content = element.getAttribute('content') || 
                                              element.getAttribute('value') || 
                                              element.textContent;
                                if (content) return content.trim();
                            }
                        } catch (e) {
                            console.error('Selector error:', e);
                        }
                    }
                    return null;
                };

            

 const findBestImage = () => {
    const imageSelectors = [
        // High-res and zoom images
        'img[data-zoom-image]',
        'img[data-large-image]',
        'img[data-old-hires]',
        '[data-zoom-image]',
        
        // Meta images
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[property="product:image"]',
        
        // Common product image patterns
        '.product__image img',
        '.product-single__image img',
        '.product-featured-img',
        '#ProductPhotoImg',
        '.product-image img',
        '#product-image img',
        '.gallery-image img',
        '[data-main-image]',
        '[id*="product"][id*="image"]',
        '[class*="product"][class*="image"]'
    ];

    for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const src = element.getAttribute('data-zoom-image') ||
                      element.getAttribute('data-large-image') ||
                      element.getAttribute('data-old-hires') ||
                      element.getAttribute('content') ||
                      element.src;
            if (src && !src.includes('logo') && !src.includes('icon')) {
                return src;
            }
        }
    }

    // Find largest image as fallback
    let bestImage = null;
    let maxArea = 0;
    document.querySelectorAll('img').forEach(img => {
        if (img.width > 200 && img.height > 200) {
            const area = img.width * img.height;
            if (area > maxArea && !img.src.includes('logo')) {
                maxArea = area;
                bestImage = img.src;
            }
        }
    });
    return bestImage;
};






                // Generic selectors that work across most e-commerce sites
                const titleSelectors = [
                    'meta[property="og:title"]',
                    'meta[name="twitter:title"]',
                    'h1',
                    '[class*="product-title"]',
                    '[class*="productTitle"]',
                    '[class*="product-name"]',
                    '[class*="productName"]',
                    '.pdp_title', // Common in many e-commerce sites
                    '#productTitle' // Amazon-style
                ];

                const descriptionSelectors = [
                    'meta[property="og:description"]',
                    'meta[name="description"]',
                    '[class*="description"]',
                    '[class*="product-details"]',
                    '[class*="productDetails"]',
                    '#feature-bullets', // Amazon-style
                    '.pdp_description', // Common in many e-commerce sites
                    '[data-testid*="description"]'
                ];

                return {
                    content: document.documentElement.innerHTML,
                    title: getMetaContent(titleSelectors) || document.title,
                    image: findBestImage(),
                    description: getMetaContent(descriptionSelectors)
                };
            });

            if (!title) {
                throw new Error('Failed to extract title');
            }

            const enhancedContent = `
                <html>
                    <head>
                        <title>${title}</title>
                        ${image ? `<meta name="product-image" content="${image}">` : ''}
                        ${description ? `<meta name="description" content="${description}">` : ''}
                        <meta name="extracted-title" content="${title}">
                    </head>
                    <body>${content}</body>
                </html>
            `;

            previewCache.set(url, enhancedContent);
            await page.close();
            return enhancedContent;

        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.message);
            if (page) await page.close();
            lastError = error;
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                continue;
            }
            throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
        }
    }
};

// Cleanup function for graceful shutdown
process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit();
});

module.exports = { fetchWithFallback };

