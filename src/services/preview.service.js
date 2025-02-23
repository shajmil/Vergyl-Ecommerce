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
                '--start-maximized'
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

        // Enhanced browser configuration
        await Promise.all([
            page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 }),
            page.setDefaultNavigationTimeout(20000),
            page.setJavaScriptEnabled(true),
            page.evaluateOnNewDocument(() => {
                // Advanced fingerprint evasion
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                        Promise.resolve({ state: Notification.permission }) :
                        originalQuery(parameters)
                );
                
                Object.defineProperties(navigator, {
                    webdriver: { get: () => undefined },
                    plugins: {
                        get: () => [
                            { name: 'Chrome PDF Plugin' },
                            { name: 'Chrome PDF Viewer' },
                            { name: 'Native Client' }
                        ]
                    }
                });

                window.navigator.chrome = {
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {}
                };
            })
        ]);

        // Site-specific configurations
        const hostname = new URL(url).hostname;
        const siteConfig = getSiteConfig(hostname);
        
        await page.setUserAgent(siteConfig.userAgent);
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'sec-ch-ua': `"Not_A Brand";v="8", "Chromium";v="120"`,
            'sec-ch-ua-platform': '"Windows"',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...siteConfig.headers
        });

        // Set site-specific cookies
        if (siteConfig.cookies) {
            await page.setCookie(...siteConfig.cookies);
        }

        // Enhanced request interception
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            const requestUrl = request.url().toLowerCase();
            
            if (siteConfig.allowedResources(resourceType, requestUrl)) {
                request.continue();
            } else {
                request.abort();
            }
        });

        // Site-specific navigation options
        const response = await page.goto(url, {
            waitUntil: siteConfig.waitUntil,
            timeout: siteConfig.timeout
        });

        // Wait for site-specific selectors
        if (siteConfig.waitForSelectors) {
            await Promise.race([
                ...siteConfig.waitForSelectors.map(selector => 
                    page.waitForSelector(selector, { timeout: 5000 }).catch(() => {})
                ),
                new Promise(resolve => setTimeout(resolve, 5000))
            ]);
        }

        // Check for anti-bot pages
        const isBlocked = await page.evaluate(siteConfig.isBlocked);
        if (isBlocked) {
            await page.close();
            throw new Error(`Access blocked by ${hostname}`);
        }

        const { content, image, title, description } = await page.evaluate((config) => {
            const getMetaContent = (selectors) => {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element?.content || element?.textContent) {
                        return (element.content || element.textContent).trim();
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


            // Site-specific + generic selectors
            const titleSelectors = [
                ...config.titleSelectors,
                'meta[property="og:title"]',
                'meta[name="twitter:title"]',
                'meta[property="product:title"]',
                'h1',
                '#productTitle',
                '.pdp-title',
                '.product-title'
            ];

            const imageSelectors = [
                ...config.imageSelectors,
                'meta[property="og:image"]',
                'meta[name="twitter:image"]',
                'meta[property="product:image"]',
                '.primary-image img',
                '.product-image img'
            ];

            const descriptionSelectors = [
                ...config.descriptionSelectors,
                'meta[property="og:description"]',
                'meta[name="description"]',
                'meta[name="twitter:description"]',
                '.product-description',
                '#productDescription'
            ];

            return {
                content: document.documentElement.innerHTML,
                title: getMetaContent(titleSelectors) || document.title,
                image: findBestImage() || getMetaContent(imageSelectors),
                description: getMetaContent(descriptionSelectors)
            };
        }, siteConfig);

        await page.close();

        // Validate extracted content
        if (!title || title.includes('Something went wrong') || title.includes('Access Denied')) {
            throw new Error(`Failed to extract content from ${hostname}`);
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
        return enhancedContent;

    } catch (error) {
        console.error('Preview generation failed:', error.message);
        throw error;
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