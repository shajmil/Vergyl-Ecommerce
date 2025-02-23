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
                process.env.PROXY ? `--proxy-server=${process.env.PROXY}` : null
            ].filter(Boolean),
            ignoreHTTPSErrors: true
        });
    }
    return browserInstance;
}

const fetchWithFallback = async(url) => {
    const cachedData = previewCache.get(url);
    if (cachedData) return cachedData;

    let retryCount = 0;
    const MAX_RETRIES = 3;
    const hostname = new URL(url).hostname;
    
    while (retryCount < MAX_RETRIES) {
        try {
            const browser = await getBrowser();
            const page = await browser.newPage();

            // Enhanced anti-bot evasion
            await page.evaluateOnNewDocument(() => {
                // Mask Puppeteer
                delete Object.getPrototypeOf(navigator).webdriver;
                
                // Mock permissions API
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' 
                        ? Promise.resolve({ state: Notification.permission })
                        : originalQuery(parameters)
                );
                
                // Add WebGL
                const getParameter = WebGLRenderingContext.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Inc.';
                    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                    return getParameter.apply(this, [parameter]);
                };

                // More sophisticated fingerprint evasion
                Object.defineProperties(navigator, {
                    hardwareConcurrency: { value: 8 },
                    deviceMemory: { value: 8 },
                    platform: { value: 'Win32' },
                    languages: { value: ['en-US', 'en'] },
                    plugins: { 
                        value: [
                            { name: 'Chrome PDF Plugin' },
                            { name: 'Chrome PDF Viewer' },
                            { name: 'Native Client' }
                        ]
                    }
                });
            });

            // Randomized viewport and user behavior
            const width = 1920 + Math.floor(Math.random() * 100);
            const height = 1080 + Math.floor(Math.random() * 100);
            await page.setViewport({ width, height, deviceScaleFactor: 1 });

            // Enhanced headers with rotating User-Agent
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="121"',
                'sec-ch-ua-platform': '"Windows"',
                'sec-ch-ua-mobile': '?0',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${121 + Math.floor(Math.random() * 5)}.0.0.0 Safari/537.36`,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            });

            // Set cookies if needed (especially for e-commerce sites)
            await page.setCookie({
                name: 'session-token',
                value: `session-${Date.now()}`,
                domain: hostname
            });

            // Smarter request interception
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                const url = request.url().toLowerCase();
                
                // Allow essential resources and site-specific assets
                if (['document', 'xhr', 'fetch'].includes(resourceType) ||
                    url.includes('assets.') ||
                    url.includes('images-') ||
                    url.includes('/product/')) {
                    request.continue();
                } else {
                    request.abort();
                }
            });

            // Add random delays and mouse movements
            await page.goto(url, {
                waitUntil: ['domcontentloaded', 'networkidle2'],
                timeout: 30000
            });

            // Simulate human-like behavior
            await page.mouse.move(Math.random() * width, Math.random() * height);
            await page.waitForTimeout(1000 + Math.random() * 2000);
            await page.mouse.wheel({ deltaY: Math.random() * 100 });

            // Enhanced content extraction with retry mechanism
            const content = await page.evaluate(async () => {
                const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
                
                // Try multiple times to extract content
                for (let i = 0; i < 3; i++) {
                    await wait(1000);
                    
                    const getContent = (selectors) => {
                        for (const selector of selectors) {
                            const element = document.querySelector(selector);
                            if (element?.content || element?.textContent) {
                                return (element.content || element.textContent).trim();
                            }
                        }
                        return null;
                    };

                    // Enhanced image extraction
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

                    const title = getContent([
                        'meta[property="og:title"]',
                        'meta[name="twitter:title"]',
                        'h1',
                        '[class*="product"][class*="title"]',
                        '[class*="product"][class*="name"]',
                        '#productTitle'
                    ]) || document.title;

                    // If we got valid content, return it
                    if (title && !title.toLowerCase().includes('something went wrong')) {
                        return {
                            content: document.documentElement.innerHTML,
                            title,
                            image: findBestImage(),
                            description: getContent([
                                'meta[property="og:description"]',
                                'meta[name="description"]',
                                '[class*="product"][class*="description"]'
                            ])
                        };
                    }
                }
                throw new Error('Failed to extract valid content');
            });

            await page.close();

            // Validate and cache content
            if (content.title && !content.title.toLowerCase().includes('something went wrong')) {
                const enhancedContent = `
                    <html>
                        <head>
                            <title>${content.title}</title>
                            ${content.image ? `<meta name="product-image" content="${content.image}">` : ''}
                            ${content.description ? `<meta name="description" content="${content.description}">` : ''}
                        </head>
                        <body>${content.content}</body>
                    </html>
                `;
                previewCache.set(url, enhancedContent);
                return enhancedContent;
            }
            throw new Error('Invalid content detected');

        } catch (error) {
            console.error(`Attempt ${retryCount + 1} failed for ${url}:`, error.message);
            retryCount++;
            
            if (retryCount === MAX_RETRIES) {
                throw new Error(`Failed to fetch preview after ${MAX_RETRIES} attempts`);
            }
            
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
        }
    }
};

// Site-specific configurations
function getSiteConfig(hostname) {
    const defaultConfig = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        headers: {},
        cookies: [],
        waitUntil: ['domcontentloaded', 'networkidle2'],
        timeout: 20000,
        titleSelectors: [],
        imageSelectors: [],
        descriptionSelectors: [],
        waitForSelectors: [],
        isBlocked: () => false,
        allowedResources: (resourceType) => ['document', 'image'].includes(resourceType)
    };

    const configs = {
        'myntra.com': {
            headers: {
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-dest': 'document',
                'sec-fetch-user': '?1'
            },
            waitForSelectors: ['.pdp-title', '.image-grid-container', '.pdp-price'],
            titleSelectors: ['.pdp-title', '.pdp-name'],
            imageSelectors: ['.image-grid-image', '.image-grid-imageContainer img'],
            descriptionSelectors: ['.pdp-product-description'],
            allowedResources: (resourceType, url) => {
                return ['document', 'xhr', 'fetch'].includes(resourceType) ||
                       url.includes('assets.myntassets.com');
            }
        },
        'amazon': {
            // ... existing Amazon config ...
        }
        // Add more site-specific configs as needed
    };

    // Match domain patterns (e.g., amazon.com, amazon.in, etc.)
    const matchedConfig = Object.entries(configs).find(([domain]) => 
        hostname.includes(domain)
    );

    return {
        ...defaultConfig,
        ...(matchedConfig ? matchedConfig[1] : {})
    };
}

// Cleanup function for graceful shutdo wn
process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit();
});

module.exports = { fetchWithFallback };