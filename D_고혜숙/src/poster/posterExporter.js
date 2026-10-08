/**
 * posterExporter.js
 * Utility to render high-resolution PNG image from Canvas or HTML element for downloading.
 */

/**
 * Downloads a canvas element as a PNG file.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
export function downloadCanvasAsPng(canvas, filename = 'ai_poster.png') {
  if (!canvas) {
    console.error('Canvas element not found for export');
    return false;
  }

  try {
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('Failed to export canvas PNG:', error);
    return false;
  }
}

export function downloadPosterUrl(posterUrl, filename = 'ai_poster.png') {
  if (typeof posterUrl !== 'string' || !posterUrl.startsWith('data:image/png')) return false;

  const link = document.createElement('a');
  link.download = filename;
  link.href = posterUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

/**
 * Generates a clean safe filename based on product name and current date/time.
 * @param {string} productName
 * @returns {string}
 */
export function generatePosterFilename(productName = 'product') {
  const sanitized = (productName || 'product')
    .replace(/[^a-zA-Z0-9가-힣_-]/g, '_')
    .slice(0, 20);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `poster_${sanitized}_${dateStr}_${timeStr}.png`;
}
