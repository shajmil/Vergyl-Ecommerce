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

    try {
        const browser = await getBrowser();
        const page = await browser.newPage();

        // Enhanced browser configuration
        await Promise.all([
            page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 }),
            page.setDefaultNavigationTimeout(20000),
            page.setJavaScriptEnabled(true),
            page.evaluateOnNewDocument(() => {
                // Enhanced fingerprint evasion
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', { 
                    get: () => [1, 2, 3, 4, 5].map(() => ({
                        name: `Chrome PDF Plugin ${Math.random()}`,
                        description: 'Portable Document Format',
                        filename: 'internal-pdf-viewer'
                    }))
                });
                
                // Add more sophisticated browser environment simulation
                window.chrome = {
                    app: { isInstalled: false },
                    runtime: {
                        connect: () => {},
                        sendMessage: () => {},
                        onMessage: { addListener: () => {} }
                    },
                    webstore: { onInstallStageChanged: {}, onDownloadProgress: {} },
                    csi: () => {},
                    loadTimes: () => {}
                };

                // Mask automation flags
                delete window.__webdriver_evaluate;
                delete window.__selenium_evaluate;
                delete window.__webdriver_script_fn;
                delete window.$cdc_asdjflasutopfhvcZLmcfl_;
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
                    if (element) {
                        const content = element.getAttribute('content') || 
                                      element.getAttribute('value') || 
                                      element.textContent;
                        if (content) return content.trim();
                    }
                }
                return null;
            };
            
            const findBestImage = () => {
                // Enhanced image selection logic
                const getImageUrl = (element) => {
                    if (!element) return null;
                    return element.getAttribute('data-zoom-image') ||
                           element.getAttribute('data-large-image') ||
                           element.getAttribute('data-old-hires') ||
                           element.getAttribute('data-a-dynamic-image') ||
                           element.getAttribute('data-original') ||
                           element.getAttribute('data-lazy') ||
                           element.getAttribute('data-src') ||
                           element.getAttribute('content') ||
                           element.src;
                };

                const isValidImage = (url) => {
                    if (!url) return false;
                    return !url.includes('logo') && 
                           !url.includes('icon') && 
                           !url.includes('captcha') &&
                           !url.includes('placeholder') &&
                           (url.match(/\.(jpg|jpeg|png|webp)/i) || 
                            url.includes('images-amazon') || 
                            url.includes('myntra-assets'));
                };

                // Try structured data first
                const jsonLd = document.querySelector('script[type="application/ld+json"]');
                if (jsonLd) {
                    try {
                        const data = JSON.parse(jsonLd.textContent);
                        const image = data.image || 
                                    (data['@graph'] && data['@graph'].find(item => item.image)?.image);
                        if (image && isValidImage(Array.isArray(image) ? image[0] : image)) {
                            return Array.isArray(image) ? image[0] : image;
                        }
                    } catch (e) {}
                }

                const imageSelectors = [
                    // Amazon specific
                    '#landingImage',
                    '#imgBlkFront',
                    '#main-image',
                    
                    // Myntra specific
                    '.image-grid-image',
                    '.image-grid-imageContainer img',
                    
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
                        const url = getImageUrl(element);
                        if (isValidImage(url)) {
                            return url;
                        }
                    }
                }

                // Enhanced fallback for largest image
                let bestImage = null;
                let maxArea = 0;
                document.querySelectorAll('img').forEach(img => {
                    const url = getImageUrl(img);
                    if (isValidImage(url)) {
                        const area = img.naturalWidth * img.naturalHeight || 
                                   img.width * img.height;
                        if (area > maxArea && area > 40000) { // Minimum size threshold
                            maxArea = area;
                            bestImage = url;
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
                image: findBestImage(),
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
        // Add retry logic with different user agent
        if (error.message.includes('blocked') || error.message.includes('Failed to extract')) {
            // Implement retry logic here
        }
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
        descriptionSelectors: [],
        waitForSelectors: [],
        isBlocked: () => {
            // Enhanced bot detection check
            return Boolean(
                document.querySelector('#captcha-alert') ||
                document.querySelector('.captcha-image') ||
                document.querySelector('#robot-verification') ||
                document.title.toLowerCase().includes('robot') ||
                document.body.innerText.includes('captcha')
            );
        },
        allowedResources: (resourceType) => ['document', 'image'].includes(resourceType),
        rotateUserAgent: true,
        maxRetries: 3,
        userAgents: [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ]
    };

    const configs = {
        'amazon': {
            headers: {
                'Accept-Language': 'en-US,en;q=0.9',
                'sec-fetch-site': 'none',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                'sec-ch-ua-mobile': '?0',
                'Referer': 'https://www.google.com/'
            },
            cookies: [
                { name: 'session-id', value: Date.now().toString(), domain: '.amazon.com' },
                { name: 'i18n-prefs', value: 'USD', domain: '.amazon.com' }
            ],
            waitForSelectors: ['#productTitle', '#landingImage', '#feature-bullets'],
            titleSelectors: ['#productTitle', '.product-title-word-break'],
            descriptionSelectors: ['#feature-bullets', '#productDescription'],
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 30000,
            allowedResources: (resourceType, url) => {
                return ['document', 'script', 'xhr', 'fetch', 'image'].includes(resourceType) ||
                       url.includes('images-amazon.com') ||
                       url.includes('media-amazon.com');
            }
        },
        'myntra.com': {
            headers: {
                'sec-fetch-site': 'same-origin',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-dest': 'document',
                'sec-fetch-user': '?1',
                'Referer': 'https://www.myntra.com/'
            },
            waitForSelectors: ['.pdp-title', '.image-grid-imageContainer'],
            titleSelectors: ['.pdp-title', '.pdp-name', 'h1.title'],
            descriptionSelectors: ['.pdp-product-description', '.index-productDescriptionContainer'],
            allowedResources: (resourceType, url) => {
                return ['document', 'xhr', 'fetch', 'script'].includes(resourceType) ||
                       url.includes('assets.myntassets.com');
            },
            isBlocked: () => {
                return Boolean(
                    document.querySelector('.error-page') ||
                    document.querySelector('.captcha-container')
                );
            }
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

// Cleanup function for graceful shutdown
process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit();
});

module.exports = { fetchWithFallback };