
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

// Different user agents to try
const USER_AGENTS = [
    // 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    // 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    // 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
    // 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

const fetchWithFallback = async(url) => {
    let lastError = null;

    // Try with agents first
    for (const userAgent of USER_AGENTS) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                timeout: 30000, // Increased timeout
                maxRedirects: 5  // Increased redirects
            });

            if (response.data) {
                console.log(`Successfully fetched with agent: ${userAgent}`);
                return response.data;
            }
        } catch (error) {
            console.log(`Agent failed ${userAgent}:`, error.message);
            lastError = error;
        }
    }

    // Fallback to Puppeteer with increased timeouts
    try {
        console.log('Falling back to puppeteer...');
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            executablePath: process.env.NODE_ENV === 'production' 
                ? '/usr/bin/google-chrome-stable' 
                : undefined
        });
        
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(30000); // Increased timeout
        
        // Set additional page configurations
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'script'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        const response = await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 // Increased timeout
        });

        if (!response.ok()) {
            throw new Error(`Failed to load page: ${response.status()} ${response.statusText()}`);
        }

        const content = await page.content();
        await browser.close();
        return content;
    } catch (error) {
        console.log('Puppeteer attempt failed:', error.message);
        throw lastError || error;
    }
};

module.exports = { fetchWithFallback };