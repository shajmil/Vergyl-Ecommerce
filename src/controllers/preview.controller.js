const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');

// Initialize cache with 24-hour TTL
const previewCache = new NodeCache({ stdTTL: 86400 });

// Different user agents to try
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

const fetchWithRetry = async (url) => {
    for (const userAgent of USER_AGENTS) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                timeout: 10000,
                maxRedirects: 5
            });
            
            if (response.data) {
                return response.data;
            }
        } catch (error) {
            console.log(`Failed with user agent ${userAgent}:`, error.message);
        }
    }
    
    throw new Error('All fetch attempts failed');
};

const extractPreviewData = (htmlContent, url) => {
    const $ = cheerio.load(htmlContent);

    // Extract basic data even if metadata is missing
    const title = $('title').first().text() || '';
    const description = $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') || 
                        $('p').first().text().trim().substring(0, 160) || '';
    
    let image = $('meta[property="og:image"]').attr('content') || 
                $('meta[name="twitter:image"]').attr('content');
    
    if (!image) {
        // Look for large images
        $('img').each(function() {
            const src = $(this).attr('src');
            const width = $(this).attr('width');
            if (src && width && parseInt(width) > 200) {
                image = src;
                return false; // break the loop
            }
        });
    }
    
    const favicon = $('link[rel="shortcut icon"]').attr('href') ||
                    $('link[rel="icon"]').attr('href') || 
                    '/favicon.ico'; // Default favicon path
    
    const domain = new URL(url).hostname.replace('www.', '');

    const preview = {
        url: url,
        title: title,
        description: description,
        image: image,
        favicon: favicon,
        domain: domain
    };

    // Fix relative URLs
    if (preview.image && !preview.image.startsWith('http')) {
        preview.image = new URL(preview.image, url).href;
    }
    if (preview.favicon && !preview.favicon.startsWith('http')) {
        preview.favicon = new URL(preview.favicon, url).href;
    }

    return preview;
};

const generateLinkPreview = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL
        let validUrl;
        try {
            validUrl = new URL(url).href;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Check cache first
        const cachedPreview = previewCache.get(validUrl);
        if (cachedPreview) {
            return res.json(cachedPreview);
        }

        // Fetch page content
        const htmlContent = await fetchWithRetry(validUrl);
        if (!htmlContent) {
            throw new Error('Failed to fetch page content');
        }

        // Extract preview data
        const preview = extractPreviewData(htmlContent, validUrl);
        
        // Store in cache
        previewCache.set(validUrl, preview);
        
        res.json(preview);
    } catch (error) {
        console.error('Link preview error:', error);
        res.status(500).json({
            error: 'Failed to generate link preview',
            message: error.message
        });
    }
};


const healthCheck = (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Preview service is healthy' });
};

module.exports = { generateLinkPreview, healthCheck }; 