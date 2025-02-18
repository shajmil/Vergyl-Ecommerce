const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const NodeCache = require('node-cache'); // You'll need to install this: npm install node-cache

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

// Initialize cache with 24-hour TTL
const previewCache = new NodeCache({ stdTTL: 86400 });

// Different user agents to try
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

const fetchWithFallback = async (url) => {
    let lastError = null;

    // Try fetching with different user agents
    for (const userAgent of USER_AGENTS) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                validateStatus: (status) => status >= 200 && status < 300,
                maxRedirects: 5,
                timeout: 15000 // Reduced timeout for faster fallback
            });

            if (response.data) {
                console.log(`Successfully fetched data with user agent: ${userAgent}`);
                return response.data;
            }
        } catch (error) {
            console.log(`Failed with user agent ${userAgent}:`, error.message);
            lastError = error;
        }
    }

    // If all user agents fail, try Puppeteer
    try {
        console.log('Attempting to fetch with Puppeteer...');
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(15000);
        await page.goto(url, { waitUntil: 'domcontentloaded' }); // Changed from networkidle0 for faster loading
        const content = await page.content();
        await browser.close();
        return content;
    } catch (error) {
        console.log('Puppeteer attempt failed:', error.message);
        throw lastError || error;
    }
};
module.exports = { fetchWithFallback };
