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
        
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['document', 'image'].includes(resourceType)) {
                request.continue();
            } else {
                request.abort();
            }
        });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Upgrade-Insecure-Requests': '1',
            'Connection': 'keep-alive'
        });

        await Promise.all([
            page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 }),
            page.setDefaultNavigationTimeout(8000),
            page.setCacheEnabled(true),
            page.setJavaScriptEnabled(false),
            page.setBypassCSP(true)
        ]);

        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 8000 
        });

        const { content, image, title } = await page.evaluate(() => {
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

            return {
                content: document.documentElement.innerHTML,
                image: findBestImage(),
                title: findProductTitle()
            };
        });

        await page.close();

        const enhancedContent = `
            <html>
                <head>
                    <title>${title || content.match(/<title>(.*?)<\/title>/)?.[1] || ''}</title>
                    ${image ? `<meta name="product-image" content="${image}">` : ''}
                    <meta name="extracted-title" content="${title || ''}">
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