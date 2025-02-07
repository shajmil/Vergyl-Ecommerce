const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

// Configure puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

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
                timeout: 30000 // Increased timeout from 10s to 30s
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
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 }); // Increased Puppeteer timeout to 30s
        const content = await page.content();
        await browser.close();
        return content;
    } catch (error) {
        console.log('Puppeteer attempt failed:', error.message);
        throw lastError || error;
    }
};

const generateLinkPreview = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log('Fetching preview for:', url);

        // Validate URL
        let validUrl;
        try {
            validUrl = new URL(url).href;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Fetch page content
        const htmlContent = await fetchWithFallback(validUrl);
        if (!htmlContent) {
            throw new Error('Failed to fetch page content');
        }

        // Parse HTML with Cheerio
        const $ = cheerio.load(htmlContent);

        // Extract metadata
        const getMetaTag = (name) => {
            return (
                $(`meta[name="${name}"]`).attr('content') ||
                $(`meta[property="og:${name}"]`).attr('content') ||
                $(`meta[name="twitter:${name}"]`).attr('content')
            );
        };

        const preview = {
            url: validUrl,
            title: $('title').first().text() || getMetaTag('title'),
            description: getMetaTag('description') || $('p').first().text(),
            image: getMetaTag('image') || $('img').first().attr('src'),
            favicon: $('link[rel="shortcut icon"]').attr('href') ||
                     $('link[rel="icon"]').attr('href'),
            domain: new URL(validUrl).hostname.replace('www.', ''),
            author: getMetaTag('author')
        };

        // Fix relative URLs
        if (preview.image && !preview.image.startsWith('http')) {
            preview.image = new URL(preview.image, validUrl).href;
        }
        if (preview.favicon && !preview.favicon.startsWith('http')) {
            preview.favicon = new URL(preview.favicon, validUrl).href;
        }

        console.log('Generated preview:', preview);
        res.json(preview);
    } catch (error) {
        console.error('Link preview error:', error);
        res.status(500).json({
            error: 'Failed to generate link preview',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = { generateLinkPreview,fetchWithFallback  };
