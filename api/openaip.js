export default async function handler(request, response) {
    const { z, x, y } = request.query;
    const apiKey = process.env.OPENAIP_API_KEY;

    if (!apiKey) {
        return response.status(500).json({ error: 'OpenAIP API key not configured' });
    }

    if (!z || !x || !y) {
        return response.status(400).json({ error: 'Missing coordinates (z, x, y)' });
    }

    const url = `https://api.tiles.openaip.net/api/data/openaip/${z}/${x}/${y}.png?apiKey=${apiKey}`;

    try {
        const imageResponse = await fetch(url);

        if (!imageResponse.ok) {
            return response.status(imageResponse.status).send('Error fetching tile');
        }

        const imageBuffer = await imageResponse.arrayBuffer();

        response.setHeader('Content-Type', 'image/png');
        // Cache for 1 day
        response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

        response.send(Buffer.from(imageBuffer));
    } catch (error) {
        console.error('Proxy error:', error);
        response.status(500).json({ error: 'Failed to fetch tile' });
    }
}
