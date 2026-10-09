export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Get the prompt sent by your frontend
    const { prompt } = req.body;
    
    // 2. Grab the hidden key from Vercel's secure backend vault
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'Backend API key is missing.' });
    }

    try {
        // 3. Make the request using the universally supported "gemini-pro" model
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error ? data.error.message : `HTTP Error ${response.status}`);
        }

        // 4. Send the AI result back to your frontend
        res.status(200).json(data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}