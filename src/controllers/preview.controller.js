const { fetchWithFallback } = require('../services/preview.service');
const cheerio = require('cheerio');

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

        // Attempt to fetch the data
        const htmlContent = await fetchWithFallback(validUrl);

        if (!htmlContent) {
            throw new Error('Failed to fetch page content');
        }

        // Load HTML content with cheerio
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
            title: $('title').first().text(),
            description: getMetaTag($, 'description') || $('p').first().text(),
            image: $('meta[name="product-image"]').attr('content') || 
                   getMetaTag($, 'image') ||
                   $('img').first().attr('src'),
            favicon: $('link[rel="shortcut icon"]').attr('href') ||
                $('link[rel="icon"]').attr('href'),
            domain: new URL(validUrl).hostname.replace('www.', ''),
            author: getMetaTag('author')
        };

        // Clean up relative URLs
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

const healthCheck = (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Preview service is healthy' });
};

module.exports = { generateLinkPreview, healthCheck }; 