const { generatePostContent } = require('./generatePost.js');
const { postToLinkedIn } = require('./postToLinkedIn.js');

(async () => {
  try {
    const postContent = await generatePostContent();
    console.log("Generated post:", postContent);
    await postToLinkedIn(postContent);
    console.log("✅ Done!");
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
