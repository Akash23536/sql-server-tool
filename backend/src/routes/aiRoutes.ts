import { Router, Request, Response } from 'express';
import { protect, AuthRequest } from '../middleware/authMiddleware';
import User from '../models/User';

const router = Router();

router.post('/ask', protect, async (req: AuthRequest, res: Response) => {
  const { query, prompt, error, model } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return res.status(401).json({ error: 'Groq API key not configured in backend .env file' });
  }

  // Fetch fresh user data to get the current aiRole
  const user = await User.findById(req.user.id);
  const systemRole = user?.aiRole || 'You are a SQL Server expert assistant. Help the user with their SQL queries. Return ONLY the SQL code if a query is requested, or a concise explanation if asked for analysis.';

  const userContent = `SQL Query:\n${query}\n\n${error ? `Execution Error:\n${error}\n\n` : ''}User Request: ${prompt}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: systemRole
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json();
      throw new Error(errorData.error?.message || 'Groq API call failed');
    }

    const data: any = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    res.json({ message: aiResponse });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'Failed to get response from AI' });
  }
});

router.get('/models', async (req: Request, res: Response) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return res.status(401).json({ error: 'Groq API key not configured' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from Groq');
    }

    const data: any = await response.json();
    // Filter and map to a simpler array if necessary, or just return the data
    const activeModels = data.data
      .filter((model: any) => !model.id.toLowerCase().includes('whisper') && !model.id.toLowerCase().includes('vision')) // Filter out non-text models if needed
      .map((model: any) => ({
        id: model.id,
        name: model.id // We can just use the ID as the name
      }));
      
    res.json(activeModels);
  } catch (error: any) {
    console.error('Models Error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

export default router;
