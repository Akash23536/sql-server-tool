import { Router, Request, Response } from 'express';

const router = Router();

router.post('/ask', async (req: Request, res: Response) => {
  const { query, prompt } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return res.status(401).json({ error: 'Groq API key not configured in backend .env file' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a SQL Server expert assistant. Help the user with their SQL queries. Return ONLY the SQL code if a query is requested, or a concise explanation if asked for analysis.'
          },
          {
            role: 'user',
            content: `SQL Query:\n${query}\n\nUser Request: ${prompt}`
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Groq API call failed');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    res.json({ message: aiResponse });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get response from AI' });
  }
});

export default router;
