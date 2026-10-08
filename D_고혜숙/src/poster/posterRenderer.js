export const POSTER_THEMES = {
  nature: {
    id: 'nature', shortName: '자연스러운', tag: '편안하고 따뜻한 분위기',
    bgGradient: ['#f0f6e9', '#dcebd3', '#bed8b4'], ink: '#173f2b', sub: '#42664d', accent: '#70a55f', accentText: '#173f2b', paper: '#fbfcf8',
  },
  luxury: {
    id: 'luxury', shortName: '고급스러운', tag: '차분하고 깊은 분위기',
    bgGradient: ['#171d19', '#27352d', '#405346'], ink: '#f7e7bb', sub: '#dfd5b7', accent: '#caa557', accentText: '#202a24', paper: '#202a24',
  },
  minimal: {
    id: 'minimal', shortName: '깔끔한', tag: '정돈되고 담백한 분위기',
    bgGradient: ['#f7f6f1', '#eaeae4', '#d8ddd7'], ink: '#1e2823', sub: '#536159', accent: '#8ca095', accentText: '#1e2823', paper: '#ffffff',
  },
  vibrant: {
    id: 'vibrant', shortName: '생동감 있는', tag: '밝고 경쾌한 분위기',
    bgGradient: ['#fff0d7', '#ffd6ad', '#f5ad7c'], ink: '#732f20', sub: '#8f4b35', accent: '#e7683f', accentText: '#732f20', paper: '#fff8ee',
  },
};

export const POSTER_COMPOSITIONS = {
  vertical: { id: 'vertical', name: '세로 집중', tag: '큰 제품 사진과 핵심 정보' },
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
  ctx.textBaseline = 'alphabetic';
  const lines = Array.isArray(text) ? text.slice(0, maxLines) : wrapText(ctx, text, maxWidth, maxLines);
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

function getContainedImageRect(image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  return {
    x: x + (width - drawWidth) / 2,
    y: y + (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}

function drawCoverImage(ctx, image, x, y, width, height) {
  if (!image?.complete || !image.naturalWidth) return;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawPortraitBackdrop(ctx, image, width, height, theme) {
  ctx.fillStyle = theme.bgGradient[1];
  ctx.fillRect(0, 0, width, height);
  if (!image?.complete || !image.naturalWidth) return;

  ctx.save();
  ctx.filter = 'blur(38px) saturate(1.12)';
  drawCoverImage(ctx, image, -54, -54, width + 108, height + 108);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = theme.bgGradient[0];
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const photo = getContainedImageRect(image, 0, Math.round(height * 0.06), width, height);
  ctx.save();
  ctx.shadowColor = 'rgba(18,35,24,.24)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(image, photo.x, photo.y, photo.width, photo.height);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.42)';
  ctx.lineWidth = 2;
  ctx.strokeRect(photo.x + 1, photo.y + 1, photo.width - 2, photo.height - 2);
  ctx.restore();
}

function renderVerticalPoster({ ctx, image, productData, theme, ratio, width, height }) {
  const { productName = '', productDescription = '', keySellingPoint = '', targetAudience = '' } = productData;
  drawPortraitBackdrop(ctx, image, width, height, theme);

  const panelX = 48;
  const panelY = 48;
  const panelWidth = width - panelX * 2;
  const inset = 38;
  const textX = panelX + inset;
  const textWidth = panelWidth - inset * 2;
  const titleY = panelY + 138;
  const title = fitTitle(ctx, productName, textWidth, 2, height > 1500 ? 80 : 72, 42);
  const titleLineHeight = title.size * 1.12;
  const descriptionFontSize = height > 1500 ? 28 : 25;
  const descriptionLineHeight = height > 1500 ? 40 : 36;
  const descriptionY = titleY + title.lines.length * titleLineHeight + 26;
  ctx.font = `${descriptionFontSize}px "Noto Sans KR", sans-serif`;
  const descriptionLines = wrapText(ctx, productDescription || '제품의 특징을 소개해 주세요.', textWidth, 2);
  const benefitY = descriptionY + descriptionLines.length * descriptionLineHeight + 24;
  ctx.font = '700 20px "Noto Sans KR", sans-serif';
  const benefitLines = keySellingPoint ? wrapText(ctx, keySellingPoint, textWidth - 40, 2) : [];
  const benefitHeight = keySellingPoint ? Math.max(58, benefitLines.length * 26 + 22) : 0;
  ctx.font = '600 18px "Noto Sans KR", sans-serif';
  const audienceLines = targetAudience
    ? wrapText(ctx, `추천 대상  ·  ${targetAudience}`, textWidth, 2)
    : [];
  const audienceY = targetAudience
    ? (keySellingPoint ? benefitY + benefitHeight + 32 : benefitY + 2)
    : 0;
  const panelBottom = targetAudience
    ? audienceY + audienceLines.length * 25 + 15
    : keySellingPoint
      ? benefitY + benefitHeight + 24
      : descriptionY + descriptionLines.length * descriptionLineHeight + 24;
  const panelHeight = panelBottom - panelY;

  ctx.save();
  ctx.shadowColor = 'rgba(17,38,25,.14)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.globalAlpha = 0.97;
  ctx.fillStyle = theme.paper;
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 34);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = theme.accent;
  roundedRect(ctx, textX, panelY + 30, 9, 30, 4);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.sub;
  ctx.font = '700 18px "Noto Sans KR", sans-serif';
  ctx.fillText('홍보 잇다  ·  PRODUCT STORY', textX + 20, panelY + 45);

  ctx.textAlign = 'right';
  ctx.fillStyle = theme.accent;
  ctx.font = '700 16px "Noto Sans KR", sans-serif';
  ctx.fillText('POSTER 01', panelX + panelWidth - inset, panelY + 45);

  drawWrappedText(ctx, title.lines, {
    x: textX,
    y: titleY,
    maxWidth: textWidth,
    maxLines: 2,
    font: `800 ${title.size}px "Noto Sans KR", sans-serif`,
    color: theme.ink,
    lineHeight: titleLineHeight,
  });

  drawWrappedText(ctx, descriptionLines, {
    x: textX,
    y: descriptionY,
    maxWidth: textWidth,
    maxLines: 2,
    font: `${descriptionFontSize}px "Noto Sans KR", sans-serif`,
    color: theme.sub,
    lineHeight: descriptionLineHeight,
  });

  if (keySellingPoint) {
    ctx.font = '700 20px "Noto Sans KR", sans-serif';
    const pointTextWidth = Math.max(0, ...benefitLines.map((line) => ctx.measureText(line).width));
    const pointWidth = Math.min(textWidth, Math.max(330, pointTextWidth + 44));
    ctx.fillStyle = theme.accent;
    roundedRect(ctx, textX, benefitY, pointWidth, benefitHeight, benefitHeight / 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = theme.accentText || theme.paper;
    ctx.font = '700 20px "Noto Sans KR", sans-serif';
    benefitLines.slice(0, 2).forEach((line, index) => {
      ctx.fillText(line, textX + 20, benefitY + 30 + index * 26);
    });
  }

  if (targetAudience) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = theme.ink;
    ctx.font = '600 18px "Noto Sans KR", sans-serif';
    audienceLines.slice(0, 2).forEach((line, index) => {
      ctx.fillText(line, textX, audienceY + 20 + index * 25);
    });
  }

  const footerY = height - 76;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = theme.paper;
  roundedRect(ctx, panelX, footerY, panelWidth, 44, 22);
  ctx.fill();
  ctx.restore();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.ink;
  ctx.font = '600 16px "Noto Sans KR", sans-serif';
  ctx.fillText('홍보 잇다  ·  제품 포스터 시안', panelX + 22, footerY + 22);
  ctx.textAlign = 'right';
  ctx.fillText(`${ratio.id}  ·  ${theme.shortName}`, panelX + panelWidth - 22, footerY + 22);
  ctx.textBaseline = 'alphabetic';
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
  if (image?.complete && image.naturalWidth) {
    ctx.save();
    ctx.filter = 'blur(26px) saturate(1.08)';
    drawCoverImage(ctx, image, x - 24, y - 24, width + 48, height + 48);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = theme.paper;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
    const photo = getContainedImageRect(image, x + width * 0.035, y + height * 0.035, width * 0.93, height * 0.93);
    ctx.drawImage(image, photo.x, photo.y, photo.width, photo.height);
  } else {
    ctx.fillStyle = theme.paper;
    ctx.fillRect(x, y, width, height);
  }
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

  const { productName = '', productDescription = '', keySellingPoint = '', targetAudience = '' } = productData;
  if (compositionKey === 'vertical') {
    renderVerticalPoster({ ctx, image: productImageObj, productData, theme, ratio, width, height });
    return true;
  }

  const isStory = ratioKey === '9:16';
  const isSquare = ratioKey === '1:1';
  const pad = 82;
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
  drawWrappedText(ctx, title.lines, {
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
      font: '700 21px "Noto Sans KR", sans-serif', color: theme.accentText || theme.paper, lineHeight: 26,
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
