const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');
const storage = require('node-persist');

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

// Initialize in-memory cache
const memoryCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Initialize persistent storage
(async () => {
    await storage.init({
        dir: './cache',
        stringify: JSON.stringify,
        parse: JSON.parse,
        encoding: 'utf8',
        logging: false,
        ttl: 24 * 60 * 60 * 1000 // 24 hours
    });
})();

// Constants
const PAGE_TIMEOUT = 15000; // 15 seconds
const VIEWPORT = { width: 375, height: 667, isMobile: true };

// Optimize cache settings
const previewCache = new NodeCache({ 
    stdTTL: 3600, // 1 hour cache
    checkperiod: 600, // Check for expired entries every 10 minutes
    useClones: false // Disable cloning for better performance
});

// Browser management
let browserInstance = null;
let isClosing = false;

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
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-extensions',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--mute-audio'
            ]
        });
        let pageCount = 0;
        browserInstance.on('targetcreated', async () => {
            pageCount++;
            if (pageCount >= 100) {
                await restartBrowser();
                pageCount = 0;
            }
        });
    }
    return browserInstance;
}

/**
 * Restart browser instance
 */
async function restartBrowser() {
    isClosing = true;
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
    isClosing = false;
}

/**
 * Extract metadata from HTML content
 * @param {string} html 
 * @param {string} baseUrl 
 * @returns {Object}
 */
function extractMetadata(html, baseUrl) {
    const $ = cheerio.load(html);
    
    const preview = {
        url: baseUrl,
        title: $('title').first().text() || $('meta[property="og:title"]').attr('content'),
        description: $('meta[name="description"]').attr('content') || 
                    $('meta[property="og:description"]').attr('content') ||
                    $('p').first().text(),
        image: $('meta[property="og:image"]').attr('content') || 
               $('img').first().attr('src'),
        favicon: $('link[rel="shortcut icon"]').attr('href') ||
                $('link[rel="icon"]').attr('href'),
        domain: new URL(baseUrl).hostname.replace('www.', '')
    };

    // Make URLs absolute
    ['image', 'favicon'].forEach(key => {
        if (preview[key] && !preview[key].startsWith('http')) {
            preview[key] = new URL(preview[key], baseUrl).href;
        }
    });

    return preview;
} 

const fetchWithFallback = async(url) => {
    // Check cache first
    const cachedData = previewCache.get(url);
    if (cachedData) {
        console.log('Returning cached data for:', url);
        return cachedData;
    }

    // Try fast axios fetch first
    try {
        const response = await axios.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
                'Accept': 'text/html',
            },
            maxRedirects: 3
        });
        
        if (response.data) {
            previewCache.set(url, response.data);
            return response.data;
        }
    } catch (error) {
        console.log('Axios attempt failed, falling back to puppeteer:', error.message);
    }

    // Fallback to puppeteer
    try {
        console.log('Attempting with puppeteer...');
        const browser = await getBrowser();
        const page = await browser.newPage();
        
        // Aggressive performance optimizations
        await Promise.all([
            page.setRequestInterception(true),
            page.setDefaultNavigationTimeout(10000),
            page.setViewport({ width: 375, height: 667, isMobile: true }),
            page.setCacheEnabled(true),
            page.setJavaScriptEnabled(false),
            page.setBypassCSP(true)
        ]);

        // Strict resource blocking
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (resourceType === 'document') {
                request.continue();
            } else {
                request.abort();
            }
        });

        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
        });

        const content = await page.content();
        await page.close();

        // Cache successful results
        if (content) {
            previewCache.set(url, content);
        }
        
        return content;
    } catch (error) { 
        console.error('Puppeteer attempt failed:', error.message);
        throw error;
    }
};

// Cleanup function for graceful shutdo wn
process.on('SIGINT', async () => {
    if (browserInstance) {
        await browserInstance.close();
    }
    process.exit();
});

module.exports = { fetchWithFallback };