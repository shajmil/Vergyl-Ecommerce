const axios = require('axios');
const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');
const cheerio = require('cheerio');

// Different user agents to try
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

// Fetch HTML using Axios
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
                timeout: 10000, // Increased timeout to 60s
                validateStatus: (status) => status >= 200 && status < 300,
                maxRedirects: 5
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
        return await fetchWithPuppeteer(url);
    } catch (error) {
        console.log('Puppeteer attempt failed:', error.message);
        throw lastError || error;
    }
};

// Fetch HTML using Puppeteer
const fetchWithPuppeteer = async (url) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--proxy-server="direct://"',
                '--proxy-bypass-list=*'
            ],
            executablePath: await chrome.executablePath,
            headless: true
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 }); // Increased timeout to 60s
        const content = await page.content();
        await browser.close();
        return content;
    } catch (error) {
        if (browser) await browser.close();
        throw new Error(`Puppeteer failed: ${error.message}`);
    }
};

module.exports = { fetchWithFallback, fetchWithPuppeteer };
