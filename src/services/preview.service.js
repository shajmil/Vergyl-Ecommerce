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
                '--disable-default-apps'
            ]
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
        
        // Aggressive performance optimization
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            // Only allow HTML and essential resources
            const resourceType = request.resourceType();
            if (['document', 'image'].includes(resourceType)) {
                request.continue();
            } else {
                request.abort();
            }
        });

        // Optimized page settings for faster load
        await Promise.all([
            page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 }),
            page.setDefaultNavigationTimeout(8000), // Reduced timeout
            page.setCacheEnabled(true),
            page.setJavaScriptEnabled(false),
            page.setBypassCSP(true)
        ]);

        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 8000 
        });

        // Extract only what we need
        const { content, image } = await page.evaluate(() => {
            // Universal selectors for product images
            const findBestImage = () => {
                // Common image selectors across e-commerce sites
                const selectors = [
                    // High-res product image attributes
                    'img[data-old-hires]',
                    'img[data-zoom-image]',
                    'img[data-large-image]',
                    
                    // Meta tags
                    'meta[property="og:image"]',
                    'meta[name="twitter:image"]',
                    'meta[property="product:image"]',
                    
                    // Common product image selectors
                    '.product-image img',
                    '#product-image img',
                    '.gallery-image img',
                    '[data-main-image]',
                    '[id*="product"][id*="image"]',
                    '[class*="product"][class*="image"]',
                    
                    // Fallback to any large image
                    'img[width="500"]',
                    'img[width="600"]',
                    'img[width="800"]'
                ];

                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const src = element.getAttribute('data-old-hires') || 
                                  element.getAttribute('data-zoom-image') || 
                                  element.getAttribute('content') ||
                                  element.src;
                        if (src && !src.includes('logo') && !src.includes('icon')) {
                            return src;
                        }
                    }
                }

                // Last resort: find largest image
                let bestImage = null;
                let maxArea = 0;
                document.querySelectorAll('img').forEach(img => {
                    if (img.width > 200 && img.height > 200) {
                        const area = img.width * img.height;
                        if (area > maxArea) {
                            maxArea = area;
                            bestImage = img.src;
                        }
                    }
                });
                return bestImage;
            };

            return {
                content: document.documentElement.innerHTML,
                image: findBestImage()
            };
        });

        await page.close();

        // Minimal HTML with only what we need
        const enhancedContent = `
            <html>
                <head>
                    <title>${content.match(/<title>(.*?)<\/title>/)?.[1] || ''}</title>
                    ${image ? `<meta name="product-image" content="${image}">` : ''}
                </head>
                <body>${content}</body>
            </html>
        `;

        previewCache.set(url, enhancedContent);
        return enhancedContent;
    } catch (error) { 
        console.error('Preview generation failed:', error.message);
        throw error;
    }
};

// Cleanup function for graceful shutdo wn
process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit();
});

module.exports = { fetchWithFallback };