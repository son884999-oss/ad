const { generateVideoPrompt } = require('../src');

// generateVideo is supplied by the team leader's video generation module.
async function createProductVideo(productData, generateVideo, { mode = 'rules' } = {}) {
  const { videoPrompt } = await generateVideoPrompt(productData, { mode });
  return generateVideo({ imageUrl: productData.imageUrl, prompt: videoPrompt });
}

module.exports = { createProductVideo };
