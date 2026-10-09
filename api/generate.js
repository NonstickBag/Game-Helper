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
        // 1. Use the official stable model (gemini-1.5-flash)
        // 2. Force strict JSON Mode so the AI can never reply with plain text
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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

        // Send the clean JSON result back to your frontend
        res.status(200).json(data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}