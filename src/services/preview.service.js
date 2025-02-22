const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const NodeCache = require('node-cache');

puppeteer.use(StealthPlugin());

// Optimize cache settings
const previewCache = new NodeCache({ 
    stdTTL: 86400,
    checkperiod: 7200,
    maxKeys: 2000,
    useClones: false // Faster cache operations
});

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
                '--no-zygote',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-extensions',
                '--disable-audio-output',
                '--disable-remote-fonts',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-client-side-phishing-detection',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--disable-dev-shm-usage',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--force-color-profile=srgb',
                '--metrics-recording-only',
                '--no-first-run',
                '--disable-site-isolation-trials'
            ]
        });
    }
    return browserInstance;
}
// ... existing code ...

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

// ... existing code ...

// Cleanup
process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit();
});

module.exports = { fetchWithFallback };