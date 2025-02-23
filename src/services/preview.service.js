const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const NodeCache = require('node-cache');

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

// Different user agents to try
const USER_AGENTS = [
    // 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    // 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    // 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
    // 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

// const fetchWithFallback = async(url) => {
//     let lastError = null;

//     // Try with agents first
//     for (const userAgent of USER_AGENTS) {
//         try {
//             const response = await axios.get(url, {
//                 headers: {
//                     'User-Agent': userAgent,
//                     'Accept': 'text/html,application/xhtml+xml',
//                     'Accept-Language': 'en-US,en;q=0.5',
//                 },
//                 timeout: 30000, // Increased timeout
//                 maxRedirects: 5  // Increased redirects
//             });

//             if (response.data) {
//                 console.log(`Successfully fetched with agent: ${userAgent}`);
//                 return response.data;
//             }
//         } catch (error) {
//             console.log(`Agent failed ${userAgent}:`, error.message);
//             lastError = error;
//         }
//     }

//     // Fallback to Puppeteer with increased timeouts
//     try {
//         console.log('Falling back to puppeteer...');
//         const browser = await puppeteer.launch({
//             headless: true,
//             args: [
//                 '--no-sandbox',
//                 '--disable-setuid-sandbox',
//                 '--disable-dev-shm-usage',
//                 '--disable-gpu',
//                 '--single-process',
//                 '--no-zygote',
//                 '--disable-web-security',
//                 '--disable-features=IsolateOrigins,site-per-process'
//             ],
//             executablePath: process.env.NODE_ENV === 'production' 
//                 ? '/usr/bin/google-chrome-stable' 
//                 : undefined
//         });
        
//         const page = await browser.newPage();
//         await page.setDefaultNavigationTimeout(30000); // Increased timeout
        
//         // Set additional page configurations
//         await page.setRequestInterception(true);
//         page.on('request', (request) => {
//             if (['image', 'stylesheet', 'font', 'script'].includes(request.resourceType())) {
//                 request.abort();
//             } else {
//                 request.continue();
//             }
//         });

//         const response = await page.goto(url, { 
//             waitUntil: 'domcontentloaded',
//             timeout: 30000 // Increased timeout
//         });

//         if (!response.ok()) {
//             throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
//         }

//         const content = await page.content();
//         await browser.close();
//         return content;
//     } catch (error) {
//         console.log('Puppeteer attempt failed:', error.message);
//         throw lastError || error;
//     }
// };

// Increased cache with better memory management
const previewCache = new NodeCache({ 
    stdTTL: 86400,
    checkperiod: 3600,
    maxKeys: 1000 
});

// Reusable browser instance
let browserInstance = null;

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
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
                // Add additional arguments to appear more human-like
                '--window-size=1920,1080',
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--enable-javascript',
                '--user-agent-client-hints'
            ],
            defaultViewport: null
        });
    }
    return browserInstance;
}

const fetchWithFallback = async(url) => {
    const cachedData = previewCache.get(url);
    if (cachedData) return cachedData;

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();

        // Enhanced browser fingerprinting evasion
        await page.evaluateOnNewDocument(() => {
            // More sophisticated webdriver evasion
            delete Object.getPrototypeOf(navigator).webdriver;
            // Fake productSub
            Object.defineProperty(navigator, 'productSub', {
                get: () => '20030107'
            });
            // Add chrome runtime
            window.chrome = {
                runtime: {},
                loadTimes: () => {},
                csi: () => {},
                app: {},
                webstore: {}
            };
        });

        // Set common headers for all sites
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'sec-ch-ua': `"Not_A Brand";v="8", "Chromium";v="120"`,
            'sec-ch-ua-platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'sec-fetch-site': 'none',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-dest': 'document'
        });

        // Site-specific configurations
        const hostname = new URL(url).hostname;
        if (hostname.includes('myntra.com')) {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            // Add Myntra-specific cookies
            await page.setCookie({
                name: 'isWebinarInvited',
                value: 'false',
                domain: '.myntra.com'
            });
        }

        // Enhanced request interception
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const reqUrl = request.url().toLowerCase();
            
            // Allow essential resources and images
            if (['document', 'xhr', 'fetch'].includes(resourceType) ||
                (resourceType === 'image' && !reqUrl.includes('tracking')) ||
                reqUrl.includes('product-image') ||
                reqUrl.includes('images/')) {
                request.continue();
            } else {
                request.abort();
            }
        });

        // Enhanced page load strategy with retry mechanism
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount <= maxRetries) {
            try {
                const response = await page.goto(url, {
                    waitUntil: ['domcontentloaded', 'networkidle2'],
                    timeout: 30000
                });

                if (!response.ok()) {
                    throw new Error(`HTTP ${response.status()}`);
                }

                // Wait for content to be available
                await page.waitForFunction(() => {
                    return document.body && document.body.innerHTML.length > 0;
                }, { timeout: 10000 });

                break;
            } catch (error) {
                if (retryCount === maxRetries) throw error;
                retryCount++;
                await page.reload({ waitUntil: ['domcontentloaded', 'networkidle2'] });
            }
        }

        // ... rest of your existing evaluate code for content extraction ...

        // Enhanced error handling for the evaluation
        const { content, image, title } = await page.evaluate(() => {
            try {
                const findProductTitle = () => {
                    // Try meta tags first (faster)
                    const metaTitleSelectors = [
                        'meta[property="og:title"]',
                        'meta[name="twitter:title"]',
                        'meta[property="product:title"]',
                        'meta[name="title"]'
                    ];

                    for (const selector of metaTitleSelectors) {
                        const meta = document.querySelector(selector);
                        if (meta?.content) {
                            const content = meta.content.trim();
                            if (content) return content;
                        }
                    }

                    // Try common product title elements
                    const titleSelectors = [
                        '#productTitle',
                        '.product-title-word-break',
                        '.product__title',
                        '.product-single__title',
                        '[class*="product"][class*="title"]',
                        '[class*="product"][class*="name"]',
                        'h1.title',
                        'h1:first-of-type'
                    ];

                    for (const selector of titleSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const text = element.textContent.trim();
                            if (text && text.length > 3) {
                                return text.replace(/\s+/g, ' ').trim();
                            }
                        }
                    }

                    return document.title.split(/[|\-–—]/)[0].trim();
                };

                const findBestImage = () => {
                    // Try meta images first (faster)
                    const metaImageSelectors = [
                        'meta[property="og:image"]',
                        'meta[name="twitter:image"]',
                        'meta[property="product:image"]'
                    ];

                    for (const selector of metaImageSelectors) {
                        const meta = document.querySelector(selector);
                        if (meta?.content) return meta.content;
                    }

                    // Try product images
                    const imageSelectors = [
                        '#landingImage',
                        '#imgBlkFront',
                        '.product__image img',
                        '.product-single__image img',
                        '.product-featured-img',
                        '[data-zoom-image]'
                    ];

                    for (const selector of imageSelectors) {
                        const img = document.querySelector(selector);
                        if (img) {
                            return img.src || img.getAttribute('data-zoom-image') || 
                                   img.getAttribute('data-large-image') || 
                                   img.getAttribute('data-old-hires');
                        }
                    }

                    // Fallback to largest visible image
                    let bestImage = null;
                    let maxArea = 0;
                    document.querySelectorAll('img').forEach(img => {
                        if (img.offsetWidth > 200 && img.offsetHeight > 200) {
                            const area = img.offsetWidth * img.offsetHeight;
                            if (area > maxArea && !img.src.includes('logo')) {
                                maxArea = area;
                                bestImage = img.src;
                            }
                        }
                    });
                    return bestImage;
                };

                return {
                    content: document.documentElement.innerHTML,
                    image: findBestImage(),
                    title: findProductTitle()
                };
            } catch (err) {
                return {
                    content: document.documentElement.innerHTML,
                    image: null,
                    title: document.title
                };
            }
        });

        await page.close();

        // Validate content before caching
        if (!content || content.includes('Please contact your administrator')) {
            throw new Error('Invalid content received');
        }

        const enhancedContent = `
            <html>
                <head>
                    <title>${title || ''}</title>
                    ${image ? `<meta name="product-image" content="${image}">` : ''}
                    <meta name="extracted-title" content="${title || ''}">
                </head>
                <body>${content}</body>
            </html>
        `;

        previewCache.set(url, enhancedContent);
        return enhancedContent;

    } catch (error) {
        console.error(`Preview generation failed for ${url}:`, error.message);
        throw error;
    }
};

// Cleanup function for graceful shutdo wn
process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit();
});

module.exports = { fetchWithFallback };