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

// Enhanced console filtering
const shouldIgnoreConsoleMessage = (text) => {
    const ignoredPatterns = [
        'net::ERR_FAILED',
        'Failed to fetch',
        'preloaded using link preload',
        'Failed to load resource',
        'Track&Report',
        'WebGL',
        'Metric emission failed',
        'error on etracker',
        'TypeError: Failed to fetch',
        'Warning -- sushi response',
        'MSAVowelsJavascriptAssets'
    ];
    return ignoredPatterns.some(pattern => text.toLowerCase().includes(pattern.toLowerCase()));
};

const fetchWithFallback = async(url) => {
    const cachedData = previewCache.get(url);
    if (cachedData) return cachedData;

    let lastError = null;
    const maxRetries = 3;
    const isAmazon = url.toLowerCase().includes('amazon');
    const isMyntra = url.toLowerCase().includes('myntra');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let page = null;
        try {
            const browser = await getBrowser();
            page = await browser.newPage();
            
            if (isMyntra) {
                // Randomize viewport size slightly
                const width = 1920 + Math.floor(Math.random() * 100);
                const height = 1080 + Math.floor(Math.random() * 100);
                await page.setViewport({ width, height, deviceScaleFactor: 1 });

                // Enhanced anti-detection script
                await page.evaluateOnNewDocument(() => {
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );
                    
                    // Overwrite navigator properties
                    Object.defineProperties(navigator, {
                        webdriver: { get: () => undefined },
                        language: { get: () => 'en-US' },
                        languages: { get: () => ['en-US', 'en'] },
                        deviceMemory: { get: () => 8 },
                        hardwareConcurrency: { get: () => 8 },
                        userAgent: { get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
                    });

                    // Add touch support
                    const touchSupport = {
                        maxTouchPoints: 5,
                        ontouchstart: null,
                        ontouchend: null,
                        ontouchmove: null,
                        ontouchcancel: null
                    };
                    Object.assign(window.navigator, touchSupport);

                    // Mock scheduling APIs
                    window.requestIdleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
                    window.cancelIdleCallback = window.cancelIdleCallback || ((id) => clearTimeout(id));
                });

                // Set more realistic headers
                await page.setExtraHTTPHeaders({
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'max-age=0',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                });

                // Set cookies
                const cookies = [
                    { name: 'AKA_A2', value: '1', domain: '.myntra.com' },
                    { name: 'at', value: 'true', domain: '.myntra.com' },
                    { name: 'cart_count', value: '0', domain: '.myntra.com' },
                    { name: 'mynt-loc-src', value: 'expiry', domain: '.myntra.com' }
                ];
                await page.setCookie(...cookies);

                // Enhanced console filtering
                page.on('console', msg => {
                    const text = msg.text();
                    if (!shouldIgnoreConsoleMessage(text)) {
                        console.log('Browser console:', text);
                    }
                });

                // Adjust timeouts based on site and attempt
                const navigationTimeout = isAmazon || isMyntra ? 90000 : (attempt === 1 ? 30000 : 45000);
                await page.setDefaultNavigationTimeout(navigationTimeout);

                // Block unnecessary resources
                await page.setRequestInterception(true);
                page.on('request', (request) => {
                    const resourceType = request.resourceType();
                    const url = request.url().toLowerCase();
                    
                    // Enhanced resource blocking
                    if (['media', 'font', 'websocket', 'manifest', 'other'].includes(resourceType) ||
                        url.includes('analytics') || 
                        url.includes('tracking') || 
                        url.includes('metrics') ||
                        url.includes('advertisement') ||
                        url.includes('sponsored') ||
                        url.includes('unagi') ||
                        url.includes('sushi') ||
                        url.includes('track') ||
                        url.includes('report') ||
                        url.includes('etracker')) {
                        request.abort();
                        return;
                    }
                    
                    // Allow essential resources
                    if (resourceType === 'document' ||
                        (resourceType === 'image' && !url.includes('sprite') && !url.includes('icon')) ||
                        (resourceType === 'script' && (url.includes('jquery') || url.includes('main')))) {
                        request.continue();
                        return;
                    }
                    
                    request.abort();
                });

                // Disable JavaScript for Amazon pages after initial load
                if (isAmazon) {
                    await page.evaluateOnNewDocument(() => {
                        // Disable tracking and error reporting
                        window.ue_csm = { ue: {} };
                        window.ue = { log: () => {}, count: () => {}, tag: () => {} };
                        window.uet = () => {};
                        window.uex = () => {};
                        window.ueLogError = () => {};
                    });
                }

                // Special handling for Myntra
                if (isMyntra) {
                    await page.evaluateOnNewDocument(() => {
                        // Emulate regular browser behavior
                        Object.defineProperty(navigator, 'webdriver', { get: () => false });
                        window.chrome = { runtime: {} };
                        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    });
                }

                // Try regular page load first
                await page.goto(url, {
                    waitUntil: ['domcontentloaded'],
                    timeout: 30000
                });

                // Wait for key elements with multiple selectors
                await Promise.race([
                    page.waitForSelector('.pdp-name'),
                    page.waitForSelector('.pdp-title'),
                    page.waitForSelector('.image-grid-imageContainer'),
                    page.waitForSelector('.pdp-image'),
                    new Promise(resolve => setTimeout(resolve, 5000))
                ]);

                // Extract content using specific Myntra selectors
                const productInfo = await page.evaluate(() => {
                    const getTitle = () => {
                        const titleElement = document.querySelector('.pdp-title') || 
                                          document.querySelector('.pdp-name') ||
                                          document.querySelector('h1.title');
                        return titleElement ? titleElement.textContent.trim() : null;
                    };

                    const getDescription = () => {
                        const descElement = document.querySelector('.pdp-product-description') ||
                                          document.querySelector('.index-productDescriptors') ||
                                          document.querySelector('.pdp-product-description-content');
                        return descElement ? descElement.textContent.trim() : null;
                    };

                    const getImage = () => {
                        // Try multiple image selectors
                        const imageElement = document.querySelector('.image-grid-imageContainer img') ||
                                           document.querySelector('.pdp-image img') ||
                                           document.querySelector('.img-responsive');
                        
                        if (imageElement) {
                            return imageElement.src || 
                                   imageElement.getAttribute('data-src') || 
                                   imageElement.getAttribute('srcset')?.split(',')[0];
                        }
                        return null;
                    };

                    const title = getTitle();
                    const description = getDescription();
                    const image = getImage();

                    if (!title && !description && !image) {
                        return null;
                    }

                    return {
                        title: title || 'Product Title Not Available',
                        description: description || 'No description available',
                        image,
                        content: document.documentElement.innerHTML
                    };
                });

                if (productInfo) {
                    previewCache.set(url, productInfo);
                    if (page) await page.close();
                    return productInfo;
                }

                // If page scraping fails, try the API as fallback
                const productId = url.split('/').slice(-2)[0];
                const apiUrl = `https://www.myntra.com/gateway/v2/product/${productId}`;
                
                const response = await page.goto(apiUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                const responseText = await response.text();
                try {
                    const data = JSON.parse(responseText);
                    if (data && data.style) {
                        const apiProductInfo = {
                            title: data.style.name || data.style.brand,
                            description: data.style.description,
                            image: data.style.media.photos[0]?.secureSrc,
                            content: `
                                <html>
                                    <head>
                                        <title>${data.style.name}</title>
                                        <meta name="description" content="${data.style.description}">
                                    </head>
                                    <body>
                                        <h1>${data.style.name}</h1>
                                        <img src="${data.style.media.photos[0]?.secureSrc}" alt="${data.style.name}">
                                        <p>${data.style.description}</p>
                                    </body>
                                </html>
                            `
                        };
                        previewCache.set(url, apiProductInfo);
                        if (page) await page.close();
                        return apiProductInfo;
                    }
                } catch (jsonError) {
                    console.error('API response parsing failed:', jsonError.message);
                    // Continue with fallback approach
                }
            }

            // Enhanced console filtering
            page.on('console', msg => {
                const text = msg.text();
                if (!shouldIgnoreConsoleMessage(text)) {
                    console.log('Browser console:', text);
                }
            });

            // Adjust timeouts based on site and attempt
            const navigationTimeout = isAmazon || isMyntra ? 90000 : (attempt === 1 ? 30000 : 45000);
            await page.setDefaultNavigationTimeout(navigationTimeout);

            // Block unnecessary resources
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                const url = request.url().toLowerCase();
                
                // Enhanced resource blocking
                if (['media', 'font', 'websocket', 'manifest', 'other'].includes(resourceType) ||
                    url.includes('analytics') || 
                    url.includes('tracking') || 
                    url.includes('metrics') ||
                    url.includes('advertisement') ||
                    url.includes('sponsored') ||
                    url.includes('unagi') ||
                    url.includes('sushi') ||
                    url.includes('track') ||
                    url.includes('report') ||
                    url.includes('etracker')) {
                    request.abort();
                    return;
                }
                
                // Allow essential resources
                if (resourceType === 'document' ||
                    (resourceType === 'image' && !url.includes('sprite') && !url.includes('icon')) ||
                    (resourceType === 'script' && (url.includes('jquery') || url.includes('main')))) {
                    request.continue();
                    return;
                }
                
                request.abort();
            });

            // Disable JavaScript for Amazon pages after initial load
            if (isAmazon) {
                await page.evaluateOnNewDocument(() => {
                    // Disable tracking and error reporting
                    window.ue_csm = { ue: {} };
                    window.ue = { log: () => {}, count: () => {}, tag: () => {} };
                    window.uet = () => {};
                    window.uex = () => {};
                    window.ueLogError = () => {};
                });
            }

            // Special handling for Myntra
            if (isMyntra) {
                await page.evaluateOnNewDocument(() => {
                    // Emulate regular browser behavior
                    Object.defineProperty(navigator, 'webdriver', { get: () => false });
                    window.chrome = { runtime: {} };
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                });
            }

            // Navigate with more lenient conditions
            const response = await page.goto(url, {
                waitUntil: ['domcontentloaded'],
                timeout: navigationTimeout
            });

            // Accept both OK and Not Modified responses
            if (!response || (!response.ok() && response.status() !== 304)) {
                throw new Error(`Invalid response: ${response?.status() || 'no response'}`);
            }

            // Enhanced wait strategy for Myntra
            if (isMyntra) {
                // Direct API approach for Myntra
                const productId = url.split('/').slice(-2)[0];
                const apiUrl = `https://www.myntra.com/gateway/v2/product/${productId}`;
                
                const apiResponse = await page.goto(apiUrl, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                if (apiResponse.ok()) {
                    const data = await apiResponse.json();
                    if (data && data.style) {
                        const productInfo = {
                            title: data.style.name || data.style.brand,
                            description: data.style.description,
                            image: data.style.media.photos[0]?.secureSrc,
                            content: `
                                <html>
                                    <head>
                                        <title>${data.style.name}</title>
                                        <meta name="description" content="${data.style.description}">
                                    </head>
                                    <body>
                                        <h1>${data.style.name}</h1>
                                        <img src="${data.style.media.photos[0]?.secureSrc}" alt="${data.style.name}">
                                        <p>${data.style.description}</p>
                                    </body>
                                </html>
                            `
                        };
                        previewCache.set(url, productInfo);
                        if (page) await page.close();
                        return productInfo;
                    }
                }

                // Fallback to regular page load if API fails
                await page.goto(url, {
                    waitUntil: ['domcontentloaded', 'networkidle0'],
                    timeout: 30000
                });

                // Wait for key elements
                await Promise.race([
                    page.waitForSelector('.pdp-name, .pdp-title', { timeout: 15000 }),
                    page.waitForSelector('.image-grid-imageContainer, .pdp-image', { timeout: 15000 }),
                    new Promise(resolve => setTimeout(resolve, 10000))
                ]);
            } else {
                // Wait for content with timeout
                await Promise.race([
                    new Promise(resolve => setTimeout(resolve, 2000)),
                    page.waitForSelector('body', { timeout: 5000 })
                ]);
            }

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
                const findProductTitle = () => {
                    // Try structured data first (JSON-LD)
                    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                    for (const script of jsonLdScripts) {
                        try {
                            const data = JSON.parse(script.textContent);
                            // Handle different JSON-LD structures
                            if (data['@type'] === 'Product' && data.name) return data.name;
                            if (data['@graph']) {
                                const product = data['@graph'].find(item => 
                                    item['@type'] === 'Product' || 
                                    item['@type'] === 'IndividualProduct'
                                );
                                if (product?.name) return product.name;
                            }
                        } catch (e) {}
                    }
    
                    // Try meta tags
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
                        // Shopify specific
                        '.product__title',
                        '.product-single__title',
                        '[data-product-title]',
                        
                        // Common e-commerce patterns
                        '[class*="product"][class*="title"]',
                        '[class*="product"][class*="name"]',
                        '[id*="product"][id*="title"]',
                        '[id*="product"][id*="name"]',
                        '.product-title',
                        '.product-name',
                        '#product-title',
                        '#product-name',
                        
                        // Generic but likely product titles
                        'h1.title',
                        'h1.name',
                        'h1:first-of-type',
                        
                        // Breadcrumb last item
                        '.breadcrumb li:last-child',
                        '[class*="breadcrumb"] span:last-child'
                    ];
    
                    for (const selector of titleSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            const text = element.textContent.trim();
                            if (text && text.length > 3) {
                                // Clean up the title
                                return text
                                    .replace(/\s+/g, ' ')          // Remove extra spaces
                                    .replace(/^\W+|\W+$/g, '')     // Remove leading/trailing special chars
                                    .replace(/\| .*$/, '')         // Remove everything after |
                                    .replace(/- .*$/, '')          // Remove everything after -
                                    .trim();
                            }
                        }
                    }
    
                    // Last resort: try to find the most prominent text
                    const h1s = Array.from(document.getElementsByTagName('h1'));
                    for (const h1 of h1s) {
                        if (h1.offsetHeight > 0 && h1.offsetWidth > 0) {
                            const text = h1.textContent.trim();
                            if (text && text.length > 3) return text;
                        }
                    }
    
                    // If still no title, try the page title
                    const pageTitle = document.title;
                    if (pageTitle) {
                        return pageTitle
                            .split(/[|\-–—]/)      // Split on common separators
                            .map(part => part.trim())
                            .filter(part => part.length > 3)
                            .shift() || pageTitle;
                    }
    
                    return '';
                };
                const findBestImage = () => {
                    const imageSelectors = [
                        // Add Myntra-specific selectors
                        '.image-grid-imageContainer img',
                        '.pdp-image img',
                        '.img-responsive',
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
                    '#productTitle', // Amazon-style
                    // Add Myntra-specific selectors
                    '.pdp-name',
                    '.pdp-title',
                ];

                const descriptionSelectors = [
                    'meta[property="og:description"]',
                    'meta[name="description"]',
                    '[class*="description"]',
                    '[class*="product-details"]',
                    '[class*="productDetails"]',
                    '#feature-bullets', // Amazon-style
                    '.pdp_description', // Common in many e-commerce sites
                    '[data-testid*="description"]',
                    // Add Myntra-specific selectors
                    '.pdp-product-description',
                    '.index-productDescriptors',
                ];

                return {
                    content: document.documentElement.innerHTML,
                    title: findProductTitle() || getMetaContent(titleSelectors) || document.title,
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
            if (page) await page.close();
            return enhancedContent;

        } catch (error) {
            console.error(`Attempt ${attempt} failed for ${url}:`, error.message);
            if (page) await page.close();
            lastError = error;
            
            if (attempt < maxRetries) {
                const backoffTime = isMyntra ? 
                    Math.pow(2, attempt) * 3000 : 
                    Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                continue;
            }

            // Return a fallback object for Myntra if all attempts fail
            if (isMyntra) {
                const fallbackInfo = {
                    title: "Myntra Product",
                    description: "Product information temporarily unavailable",
                    image: null,
                    content: "<html><body><p>Content temporarily unavailable</p></body></html>"
                };
                previewCache.set(url, fallbackInfo);
                return fallbackInfo;
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

