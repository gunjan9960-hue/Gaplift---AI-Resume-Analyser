export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resumeText, jobDescription, jobUrl, extraContext } = req.body;

  if (!resumeText && !jobDescription) {
    return res.status(400).json({ error: 'Missing resume or job description' });
  }

  const prompt = `You are an expert resume coach and career strategist. A job seeker has shared their resume and a job description with you.

RESUME:
${resumeText || '(uploaded as file — treat as provided)'}

JOB DESCRIPTION:
${jobDescription || jobUrl || '(provided via URL)'}

EXTRA CONTEXT FROM CANDIDATE:
${extraContext || 'None provided'}

Your task is to produce a JSON response with this EXACT structure (no markdown, no backticks, just raw JSON):

{
  "versions": [
    {
      "id": "v1",
      "label": "Version 1",
      "recommended": true,
      "title": "Full-Stack Alignment",
      "desc": "Maximally aligned to the JD — every bullet tuned to match the role's language and priorities.",
      "additionsCount": 6,
      "resumeText": "FULL REWRITTEN RESUME TEXT HERE — wrap any new or changed text in %%double percent signs%% so the user can see what changed"
    },
    {
      "id": "v2",
      "label": "Version 2",
      "recommended": false,
      "title": "Metrics-Forward",
      "desc": "Leads with numbers and impact — ideal if the role values quantifiable outcomes.",
      "additionsCount": 4,
      "resumeText": "FULL REWRITTEN RESUME TEXT HERE with %%highlighted changes%%"
    },
    {
      "id": "v3",
      "label": "Version 3",
      "recommended": false,
      "title": "Narrative & Leadership",
      "desc": "Emphasises strategic thinking and leadership voice.",
      "additionsCount": 3,
      "resumeText": "FULL REWRITTEN RESUME TEXT HERE with %%highlighted changes%%"
    }
  ],
  "techSkills": [
    { "name": "Skill name", "priority": "high", "reason": "Why this skill matters for this specific role" },
    { "name": "Skill name", "priority": "medium", "reason": "Why this skill matters" },
    { "name": "Skill name", "priority": "low", "reason": "Why this skill matters" }
  ],
  "softSkills": [
    { "name": "Skill name", "priority": "high", "reason": "Why this skill matters for this specific role" },
    { "name": "Skill name", "priority": "medium", "reason": "Why this skill matters" }
  ]
}

RULES:
- Use the ACTUAL candidate's name, experience, and details from their resume
- Tailor ALL three versions specifically to THIS job description
- Wrap new additions and changed phrases in %%double percent signs%%
- Keep the resume in plain text format (no HTML)
- Return ONLY the JSON object, nothing else, no markdown fences`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return res.status(500).json({ error: 'Claude API failed', details: err });
    }

    const data = await response.json();
    const rawText = data.content[0].text.trim();

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      // Try stripping markdown fences if present
      const clean = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      parsed = JSON.parse(clean);
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
