export default async function handler(req, res) {
    const { type, ids } = req.query;

    if (!type || !ids) {
        return res.status(400).json({ error: 'Missing type or ids parameter' });
    }

    if (type !== 'metar' && type !== 'taf') {
        return res.status(400).json({ error: 'Invalid type. Must be metar or taf' });
    }

    const url = `https://aviationweather.gov/api/data/${type}?ids=${ids}&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Weather API responded with ${response.status}`);
        }
        const data = await response.json();

        // Cache for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        res.status(200).json(data);
    } catch (error) {
        console.error('Weather Proxy Error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
}
