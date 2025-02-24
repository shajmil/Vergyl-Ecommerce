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
            
            // Enhanced Myntra-specific configurations
            if (isMyntra) {
                // More sophisticated browser fingerprinting
                await page.evaluateOnNewDocument(() => {
                    // Override navigator properties
                    const newProto = navigator.__proto__;
                    delete newProto.webdriver;
                    navigator.__proto__ = newProto;
                    
                    // Add language preferences
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en', 'hi'],
                    });
                    
                    // Add more realistic plugins
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [
                            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                            { name: 'Chrome PDF Viewer', filename: 'chrome-pdf-viewer' },
                            { name: 'Native Client', filename: 'native-client' }
                        ],
                    });

                    // Add window properties
                    window.chrome = {
                        app: {
                            isInstalled: false,
                            InstallState: {
                                DISABLED: 'disabled',
                                INSTALLED: 'installed',
                                NOT_INSTALLED: 'not_installed'
                            },
                            RunningState: {
                                CANNOT_RUN: 'cannot_run',
                                READY_TO_RUN: 'ready_to_run',
                                RUNNING: 'running'
                            }
                        },
                        runtime: {
                            PlatformOs: {
                                MAC: 'mac',
                                WIN: 'win',
                                ANDROID: 'android',
                                CROS: 'cros',
                                LINUX: 'linux',
                                OPENBSD: 'openbsd'
                            },
                            PlatformArch: {
                                ARM: 'arm',
                                X86_32: 'x86-32',
                                X86_64: 'x86-64'
                            },
                            RequestUpdateCheckStatus: {
                                THROTTLED: 'throttled',
                                NO_UPDATE: 'no_update',
                                UPDATE_AVAILABLE: 'update_available'
                            },
                            OnInstalledReason: {
                                INSTALL: 'install',
                                UPDATE: 'update',
                                CHROME_UPDATE: 'chrome_update',
                                SHARED_MODULE_UPDATE: 'shared_module_update'
                            },
                            OnRestartRequiredReason: {
                                APP_UPDATE: 'app_update',
                                OS_UPDATE: 'os_update',
                                PERIODIC: 'periodic'
                            }
                        }
                    };
                });

                // Enhanced headers for Myntra
                await page.setExtraHTTPHeaders({
                    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
                    'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120", "Not=A?Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-User': '?1',
                    'Sec-Fetch-Dest': 'document',
                    'Accept-Encoding': 'gzip, deflate, br'
                });

                // Set cookies for Myntra
                await page.setCookie({
                    name: 'AKA_A2', 
                    value: '1',
                    domain: '.myntra.com'
                });
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
                // Wait longer for initial render
                await page.goto(url, {
                    waitUntil: ['networkidle0', 'domcontentloaded'],
                    timeout: navigationTimeout
                });

                // Wait for key elements with multiple attempts
                for (let i = 0; i < 3; i++) {
                    try {
                        await Promise.race([
                            page.waitForSelector('.pdp-name, .pdp-title', { timeout: 10000 }),
                            page.waitForSelector('.image-grid-imageContainer, .pdp-image', { timeout: 10000 }),
                            new Promise(resolve => setTimeout(resolve, 8000))
                        ]);
                        break;
                    } catch (e) {
                        if (i === 2) throw e;
                        await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });
                    }
                }
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
            if (page) await page.close();
            return enhancedContent;

        } catch (error) {
            console.error(`Attempt ${attempt} failed for ${url}:`, error.message);
            if (page) await page.close();
            lastError = error;
            
            if (attempt < maxRetries) {
                // Increased backoff for Myntra
                const backoffTime = isMyntra ? 
                    Math.pow(2, attempt) * 2000 : 
                    Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, backoffTime));
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

