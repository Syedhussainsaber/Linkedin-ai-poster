require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generatePostContent() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Choose a random topic
  const topics = [
    "Next.js best practices",
    "Using Docker in MERN apps",
    "Advantages of Prisma ORM",
    "React Query vs Redux",
    "Using Zustand for state management",
    "Tips for Git & GitHub workflow",
    "How to structure your MERN stack projects"
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];

  const prompt = `Write a professional and engaging LinkedIn post about ${topic}. 
Follow this structure:
- Start with a bold question or statement as a hook.
- Add 2–3 short paragraphs explaining key insights or tips (use simple, clear language).
- Use 1–2 relevant emojis naturally (but keep it professional).
- End with a short call-to-action encouraging comments or discussion.
- Add 2–3 relevant hashtags on the last line.
Keep the tone friendly, professional, and authentic. Use clean spacing and formatting to improve readability. Do NOT write a title — just the post content.`;


  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

// Export so other files can use
module.exports = { generatePostContent };
