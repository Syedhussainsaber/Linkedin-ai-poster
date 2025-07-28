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

  const prompt = `Write a short, engaging LinkedIn post about ${topic}. Use 2-3 relevant hashtags. Keep it professional and friendly.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

// Export so other files can use
module.exports = { generatePostContent };
