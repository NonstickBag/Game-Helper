export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Backend API key is missing.' });
    }

    try {
        // Use the modern model version as required by Google
        // Strict JSON mode is enabled to guarantee frontend compatibility
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error ? data.error.message : `HTTP Error ${response.status}`);
        }

        res.status(200).json(data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}