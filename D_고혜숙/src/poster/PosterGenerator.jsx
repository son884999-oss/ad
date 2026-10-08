import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { renderPosterToCanvas, POSTER_RATIOS } from './posterRenderer';

export const PosterGenerator = forwardRef(function PosterGenerator({
  productData,
  imageUrl,
  generatedBackgroundUrl = '',
  selectedTheme = 'nature',
  selectedRatio = '4:5',
  selectedComposition = 'vertical',
  onStatusChange,
}, ref) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const [status, setStatus] = useState(imageUrl ? 'loading' : 'empty');
  const [errorMessage, setErrorMessage] = useState('');

  useImperativeHandle(ref, () => ({
    exportPoster() {
      if (status !== 'ready' || !canvasRef.current) {
        throw new Error(errorMessage || '제품 사진이 준비될 때까지 기다려 주세요.');
      }
      try {
        return canvasRef.current.toDataURL('image/png');
      } catch {
        throw new Error('이미지 주소에서 내보내기를 허용하지 않습니다. 제품 사진 파일을 직접 올려 주세요.');
      }
    },
  }), [errorMessage, status]);

  useEffect(() => {
    setErrorMessage('');
    imageRef.current = null;
    backgroundImageRef.current = null;
    if (!imageUrl) {
      setStatus('empty');
      return undefined;
    }

    setStatus('loading');
    let cancelled = false;
    const loadImage = (url, label) => new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`${label}를 불러오지 못했습니다. 이미지 주소와 CORS 설정을 확인해 주세요.`));
      image.src = url;
    });

    Promise.all([
      loadImage(imageUrl, '제품 사진'),
      generatedBackgroundUrl ? loadImage(generatedBackgroundUrl, '배경 이미지') : Promise.resolve(null),
    ]).then(([productImage, backgroundImage]) => {
      if (cancelled) return;
      imageRef.current = productImage;
      backgroundImageRef.current = backgroundImage;
      setStatus('ready');
    }).catch((error) => {
      if (cancelled) return;
      setErrorMessage(error instanceof Error ? error.message : '이미지를 불러오지 못했습니다.');
      setStatus('error');
    });
    return () => { cancelled = true; };
  }, [generatedBackgroundUrl, imageUrl]);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderPosterToCanvas({
      canvas: canvasRef.current,
      productData,
      productImageObj: imageRef.current,
      backgroundImageObj: backgroundImageRef.current,
      themeKey: selectedTheme,
      ratioKey: selectedRatio,
      compositionKey: selectedComposition,
    });
  }, [productData, selectedTheme, selectedRatio, selectedComposition, status]);

  useEffect(() => {
    onStatusChange?.(status, errorMessage);
  }, [errorMessage, onStatusChange, status]);

  const ratio = POSTER_RATIOS[selectedRatio] || POSTER_RATIOS['4:5'];

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div
        className="relative w-full overflow-hidden rounded-[18px] bg-white shadow-[0_22px_50px_rgba(32,58,41,0.18)] ring-1 ring-black/5"
        style={{ aspectRatio: `${ratio.width} / ${ratio.height}` }}
      >
        <canvas ref={canvasRef} className="block h-full w-full object-contain" aria-label={`${productData.productName || '제품'} 포스터 미리보기`} />
        {(status === 'loading' || status === 'empty' || status === 'error') && (
          <div className="absolute inset-0 grid place-items-center bg-white/85 p-6 text-center backdrop-blur-sm" role="status" aria-live="polite">
            {status === 'loading' && <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#496052] shadow-lg"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" /> 사진을 불러오고 있어요</span>}
            {status === 'empty' && <span className="text-sm font-semibold text-[#66736a]">제품 사진을 선택해 주세요.</span>}
            {status === 'error' && <span className="max-w-xs text-sm font-semibold leading-6 text-[#9a493f]">{errorMessage}</span>}
          </div>
        )}
      </div>
    </div>
  );
});
