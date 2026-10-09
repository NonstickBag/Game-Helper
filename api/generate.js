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
        // 1. Ask Google what models are actually available for this specific API key right now
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const listData = await listResponse.json();

        if (!listResponse.ok) {
            throw new Error(listData.error ? listData.error.message : 'Failed to fetch model list');
        }

        // 2. Filter the list to find models that specifically support code/text generation
        const validModels = listData.models.filter(m =>
            m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')
        );

        if (validModels.length === 0) {
            throw new Error("Your API key does not have access to any valid generation models.");
        }

        // 3. Auto-pick the best available model (Prefer Flash, then Pro, then fallback to whatever is first)
        let targetModel = validModels.find(m => m.name.includes('flash'))
                       || validModels.find(m => m.name.includes('pro'))
                       || validModels[0];

        // 4. Make the actual request using the dynamically found model name (targetModel.name)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${targetModel.name}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error ? data.error.message : `HTTP Error ${response.status}`);
        }

        // 5. Send the AI result back to your frontend
        res.status(200).json(data);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}