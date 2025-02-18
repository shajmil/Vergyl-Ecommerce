
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

// Different user agents to try
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

const fetchWithFallback = async(url) => {
    let lastError = null;

    // Try each user agent
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
                validateStatus: function(status) {
                    return status >= 200 && status < 300;
                },
                maxRedirects: 5,
                timeout: 10000,
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

    // If all user agents fail, try puppeteer
    try {
        console.log('Attempting to fetch with puppeteer...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
        const content = await page.content();
        await browser.close();
        return content;
    } catch (error) {
        console.log('Puppeteer attempt failed:', error.message);
        throw lastError || error;
    }
};

module.exports = { fetchWithFallback }; 