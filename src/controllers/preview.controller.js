const { fetchWithFallback } = require('../services/preview.service');
const cheerio = require('cheerio');
const axios = require('axios');

const generateLinkPreview = async (req, res) => {
    let validUrl;
    const { url } = req.body;

    try {
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log('Fetching preview for:', url);

        // Validate URL
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
            product_link: validUrl,
            product_name: $('meta[name="extracted-title"]').attr('content') ||
                getMetaTag($, 'title') ||
                $('title').first().text().split('|')[0].trim(),
            description: getMetaTag($, 'description') || $('p').first().text(),
            image_link: $('meta[name="product-image"]').attr('content') ||
                getMetaTag($, 'image') ||
                $('img').first().attr('src'),
            favicon: $('link[rel="shortcut icon"]').attr('href') ||
                $('link[rel="icon"]').attr('href'),
            domain: new URL(validUrl).hostname.replace('www.', ''),
            author: getMetaTag('author')
        };

        // Clean up relative URLs
        if (preview.image_link && !preview.image_link.startsWith('http')) {
            preview.image_link = new URL(preview.image_link, validUrl).href;
        }
        if (preview.favicon && !preview.favicon.startsWith('http')) {
            preview.favicon = new URL(preview.favicon, validUrl).href;
        }

        console.log('Generated preview:', preview);

        res.json(preview);
    } catch (error) {
        // const result = await captureProductImage(url);
        // var image_link = "";

        // if (result.success) {
        //     image_link = result.imageUrl;
        //     console.log('Direct API URL:', result.imageUrl);
        //     console.log('Base64 Data URL:', result.dataUrl);
        // } else {
        //     console.error('Error:', result.error);
        // }

        const preview = {
            product_link: validUrl,
            product_name: "",
            description: "",
            image_link: image_link,
            favicon: "",
            domain: "",
            author: ""
        };
        res.status(200).json(preview);

        // console.error('Link preview error:', error);
        // res.status(500).json({
        //     error: 'Failed to generate link preview',
        //     message: error.message,
        //     stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        // });
    }
};
async function captureProductImage(productUrl, options = {}) {
    try {
        // const {
        //     accessKey = 'T10r333Zxklqhg',
        //     delay = 3000,
        //     waitForNetworkIdle = 1000,
        //     cropSelector = '.product-image, .product-img, [data-testid="product-image"], .main-image, .product-photo',
        //     viewportWidth = 375,
        //     viewportHeight = 667,
        //     timeout = 60
        // } = options;

        // // Build the screenshot API URL
        // const screenshotParams = new URLSearchParams({
        //     access_key: accessKey,
        //     url: productUrl,
        //     viewport_width: viewportWidth,
        //     viewport_height: viewportHeight,
        //     viewport_mobile: 'true',
        //     format: 'jpg',
        //     image_quality: 80,
        //     block_ads: 'true',
        //     block_cookie_banners: 'true',
        //     block_banners_by_heuristics: 'true',
        //     block_trackers: 'true',
        //     delay: delay,
        //     wait_for_network_idle: waitForNetworkIdle,
        //     timeout: timeout,
        //     response_type: 'by_format',
        //     // Crop to product image area
        //     element_to_screenshot: cropSelector,
        //     // Add some padding around the element
        //     element_screenshot_options: JSON.stringify({
        //         padding: 10,
        //         background_color: '#ffffff'
        //     }),
        //     // Wait for images to load
        //     wait_for_element: '.product-image img, .product-img img, [data-testid="product-image"] img',
        //     wait_for_element_timeout: 10000
        // });

        const response = await axios({
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'GET',
            url: 'https://api.screenshotone.com/take',
            params: {
                access_key: "T10r333Zxklqhg",
                url: productUrl,
                viewport_width: "500",
                viewport_height: "600",
                device_scale_factor: "2",
                format: "jpg",
                block_cookie_banners: "true",
                block_trackers: "true",
                block_resources: "script",
                timeout: "60",
                image_quality: "80",
                response_type: "json" // Add this parameter to get JSON response with URL
            }
        });

        if (response.status === 200) {
            console.log("API response:", response.data);
            const screenshotUrl = response.data.screenshot_url; // The URL should be in response.data.url
            console.log("Screenshot URL:", screenshotUrl);

            // Convert to base64 data URL
            // const base64Image = Buffer.from(response.data).toString('base64');
            // const dataUrl = `data:image/jpeg;base64,${base64Image}`;

            return {
                success: true,
                imageUrl: screenshotUrl,
                // dataUrl: dataUrl,
                // imageBuffer: response.data
            };
        } else {
            throw new Error(`Screenshot API returned status: ${response.status}`);
        }

    } catch (error) {
        console.error('Error capturing product image:', error.message);
        return {
            success: false,
            error: error.message,
            imageUrl: null,
            dataUrl: null
        };
    }
}
const healthCheck = (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Preview service is healthy' });
};

module.exports = { generateLinkPreview, healthCheck }; 