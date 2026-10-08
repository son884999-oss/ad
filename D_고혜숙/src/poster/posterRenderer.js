export const POSTER_THEMES = {
  nature: {
    id: 'nature', shortName: '자연스러운', tag: '편안하고 따뜻한 분위기',
    bgGradient: ['#f0f6e9', '#dcebd3', '#bed8b4'], ink: '#173f2b', sub: '#42664d', accent: '#70a55f', paper: '#fbfcf8',
  },
  luxury: {
    id: 'luxury', shortName: '고급스러운', tag: '차분하고 깊은 분위기',
    bgGradient: ['#171d19', '#27352d', '#405346'], ink: '#f7e7bb', sub: '#dfd5b7', accent: '#caa557', paper: '#202a24',
  },
  minimal: {
    id: 'minimal', shortName: '깔끔한', tag: '정돈되고 담백한 분위기',
    bgGradient: ['#f7f6f1', '#eaeae4', '#d8ddd7'], ink: '#1e2823', sub: '#536159', accent: '#8ca095', paper: '#ffffff',
  },
  vibrant: {
    id: 'vibrant', shortName: '생동감 있는', tag: '밝고 경쾌한 분위기',
    bgGradient: ['#fff0d7', '#ffd6ad', '#f5ad7c'], ink: '#732f20', sub: '#8f4b35', accent: '#e7683f', paper: '#fff8ee',
  },
};

export const POSTER_COMPOSITIONS = {
  vertical: { id: 'vertical', name: '세로 집중', tag: '제품과 문구를 차례로' },
  split: { id: 'split', name: '사이드 분할', tag: '문구와 사진을 나란히' },
  editorial: { id: 'editorial', name: '에디토리얼', tag: '사진을 먼저 보여주기' },
};

export const POSTER_RATIOS = {
  '4:5': { id: '4:5', width: 1080, height: 1350, label: 'SNS 세로형', platform: 'Instagram' },
  '1:1': { id: '1:1', width: 1080, height: 1080, label: '정사각형', platform: 'Feed' },
  '9:16': { id: '9:16', width: 1080, height: 1920, label: '스토리 세로형', platform: 'Story' },
};

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let line = '';
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);
    line = '';
    for (const character of word) {
      const next = line + character;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        if (line) lines.push(line);
        line = character;
      }
    }
  }

  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  const last = clipped[maxLines - 1];
  clipped[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : '…';
  return clipped;
}

function drawWrappedText(ctx, text, { x, y, maxWidth, maxLines, font, color, lineHeight }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const lines = wrapText(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

function drawContainedImage(ctx, image, x, y, width, height, background) {
  ctx.fillStyle = background;
  ctx.fillRect(x, y, width, height);
  if (!image?.complete || !image.naturalWidth) return;

  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawProductPhoto(ctx, image, rect, theme) {
  const { x, y, width, height } = rect;
  ctx.save();
  ctx.shadowColor = 'rgba(25,48,31,.20)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = theme.paper;
  roundedRect(ctx, x, y, width, height, 42);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, x, y, width, height, 42);
  ctx.clip();
  drawContainedImage(ctx, image, x, y, width, height, theme.paper);
  ctx.restore();
}

function fitTitle(ctx, text, maxWidth, maxLines, startSize, minSize) {
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = `800 ${size}px "Noto Sans KR", sans-serif`;
    const lines = wrapText(ctx, text || '제품명을 입력하세요', maxWidth, maxLines);
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth)) return { size, lines };
  }
  ctx.font = `800 ${minSize}px "Noto Sans KR", sans-serif`;
  return { size: minSize, lines: wrapText(ctx, text || '제품명을 입력하세요', maxWidth, maxLines) };
}

export function renderPosterToCanvas({
  canvas,
  productData = {},
  productImageObj,
  themeKey = 'nature',
  ratioKey = '4:5',
  compositionKey = 'vertical',
}) {
  if (!canvas) return false;
  const theme = POSTER_THEMES[themeKey] || POSTER_THEMES.nature;
  const ratio = POSTER_RATIOS[ratioKey] || POSTER_RATIOS['4:5'];
  const { width, height } = ratio;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const isStory = ratioKey === '9:16';
  const isSquare = ratioKey === '1:1';
  const pad = 82;
  const { productName = '', productDescription = '', keySellingPoint = '', targetAudience = '' } = productData;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, theme.bgGradient[0]);
  background.addColorStop(0.6, theme.bgGradient[1]);
  background.addColorStop(1, theme.bgGradient[2]);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = theme.ink;
  ctx.font = '700 24px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('홍보 잇다  ·  PRODUCT STORY', pad, 82);

  const badge = '샘플 포스터';
  ctx.font = '700 20px "Noto Sans KR", sans-serif';
  const badgeWidth = ctx.measureText(badge).width + 34;
  ctx.fillStyle = theme.paper;
  roundedRect(ctx, width - pad - badgeWidth, 48, badgeWidth, 48, 24);
  ctx.fill();
  ctx.fillStyle = theme.sub;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, width - pad - badgeWidth / 2, 72);
  ctx.textBaseline = 'alphabetic';

  let imageRect;
  let titleX = pad;
  let titleY;
  let titleWidth;
  let descriptionY;
  let copyWidth;
  let maxTitleLines;
  let titleSize;

  if (compositionKey === 'editorial') {
    imageRect = { x: pad, y: isStory ? 150 : 125, width: width - pad * 2, height: isStory ? 930 : isSquare ? 450 : 560 };
    titleY = imageRect.y + imageRect.height + (isStory ? 100 : 88);
    titleWidth = width - pad * 2;
    descriptionY = titleY + (isStory ? 150 : 120);
    copyWidth = titleWidth * 0.9;
    maxTitleLines = 2;
    titleSize = isStory ? 80 : 66;
  } else if (compositionKey === 'split' && !isSquare) {
    imageRect = { x: 570, y: isStory ? 400 : 300, width: 430, height: isStory ? 1080 : 760 };
    titleX = pad;
    titleY = isStory ? 430 : 370;
    titleWidth = imageRect.x - titleX - 52;
    descriptionY = titleY + (isStory ? 330 : 270);
    copyWidth = titleWidth;
    maxTitleLines = isStory ? 5 : 4;
    titleSize = isStory ? 70 : 58;
  } else {
    imageRect = { x: 132, y: isStory ? 590 : isSquare ? 325 : 345, width: 816, height: isStory ? 880 : isSquare ? 400 : 570 };
    titleY = isStory ? 230 : isSquare ? 150 : 178;
    titleWidth = width - pad * 2;
    descriptionY = imageRect.y + imageRect.height + (isStory ? 84 : 70);
    copyWidth = titleWidth * 0.92;
    maxTitleLines = isStory ? 3 : 2;
    titleSize = isStory ? 78 : 68;
  }

  const title = fitTitle(ctx, productName, titleWidth, maxTitleLines, titleSize, 38);
  drawWrappedText(ctx, title.lines.join(' '), {
    x: titleX, y: titleY, maxWidth: titleWidth, maxLines: maxTitleLines,
    font: `800 ${title.size}px "Noto Sans KR", sans-serif`, color: theme.ink, lineHeight: title.size * 1.17,
  });

  if (imageRect) drawProductPhoto(ctx, productImageObj, imageRect, theme);

  const descriptionLines = isStory ? 3 : 2;
  drawWrappedText(ctx, productDescription || '제품의 특징을 소개해 주세요.', {
    x: titleX, y: descriptionY, maxWidth: copyWidth, maxLines: descriptionLines,
    font: `${isStory ? 30 : 26}px "Noto Sans KR", sans-serif`, color: theme.sub, lineHeight: isStory ? 44 : 38,
  });

  let metaY = descriptionY + descriptionLines * (isStory ? 44 : 38) + 26;
  if (keySellingPoint) {
    ctx.fillStyle = theme.accent;
    roundedRect(ctx, titleX, metaY - 28, Math.min(copyWidth, 580), 54, 27);
    ctx.fill();
    drawWrappedText(ctx, keySellingPoint, {
      x: titleX + 22, y: metaY + 8, maxWidth: Math.min(copyWidth, 536), maxLines: 1,
      font: '700 21px "Noto Sans KR", sans-serif', color: theme.paper, lineHeight: 26,
    });
    metaY += 72;
  }

  if (targetAudience) {
    drawWrappedText(ctx, `추천 대상  ·  ${targetAudience}`, {
      x: titleX, y: Math.min(metaY + 12, height - 104), maxWidth: copyWidth, maxLines: 1,
      font: '600 19px "Noto Sans KR", sans-serif', color: theme.ink, lineHeight: 24,
    });
  }

  ctx.fillStyle = theme.ink;
  ctx.font = '600 18px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('홍보 잇다  ·  AI 포스터 모듈', pad, height - 54);
  ctx.textAlign = 'right';
  ctx.fillText(`${ratio.id}  ·  ${theme.shortName}`, width - pad, height - 54);
  return true;
}
