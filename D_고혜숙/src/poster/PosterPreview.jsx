import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Download,
  ImagePlus,
  LoaderCircle,
  Palette,
  ShieldCheck,
  Sparkles,
  Type,
  Upload,
} from 'lucide-react';
import { PosterGenerator } from './PosterGenerator';
import { POSTER_COMPOSITIONS, POSTER_RATIOS, POSTER_THEMES } from './posterRenderer';
import { downloadPosterUrl, generatePosterFilename } from './posterExporter';

const SAMPLE_PRODUCT_DATA = {
  productName: '쵸이셀 올인원 샴푸',
  productDescription: '헤어부터 페이스, 바디까지 한 번에 사용하는 데일리 올인원 케어',
  keySellingPoint: '하나로 간편하게 이어지는 데일리 케어',
  targetAudience: '간편한 샤워 루틴을 찾는 분',
  brandTone: POSTER_THEMES.nature.tag,
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function normalizeProductData(input = {}) {
  return Object.fromEntries(Object.keys(SAMPLE_PRODUCT_DATA).map((field) => [
    field,
    typeof input?.[field] === 'string' ? input[field] : SAMPLE_PRODUCT_DATA[field],
  ]));
}

function getThemeForTone(brandTone) {
  return Object.entries(POSTER_THEMES).find(([themeKey, theme]) => (
    brandTone === themeKey || brandTone === theme.name || brandTone === theme.shortName || brandTone === theme.tag
  ))?.[0] || 'nature';
}

export function PosterPreview({
  initialProductData = SAMPLE_PRODUCT_DATA,
  initialImageUrl = '/sample-product.png',
  onPosterReady,
}) {
  const [productData, setProductData] = useState(() => normalizeProductData(initialProductData));
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [fileName, setFileName] = useState(initialImageUrl ? '샘플 제품 이미지' : '제품 사진을 선택해 주세요');
  const [selectedTheme, setSelectedTheme] = useState(() => getThemeForTone(initialProductData.brandTone));
  const [selectedRatio, setSelectedRatio] = useState('4:5');
  const [selectedComposition, setSelectedComposition] = useState('vertical');
  const [imageStatus, setImageStatus] = useState(initialImageUrl ? 'loading' : 'empty');
  const [posterUrl, setPosterUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const generatorRef = useRef(null);
  const objectUrlRef = useRef('');

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const clearGeneratedResult = () => {
    setPosterUrl('');
    setErrorMessage('');
    setNotice('');
  };

  const handleFieldChange = (field, value) => {
    setProductData((current) => ({ ...current, [field]: value }));
    clearGeneratedResult();
  };

  const handleImageStatus = useCallback((status, message) => {
    setImageStatus(status);
    if (status === 'error') setErrorMessage(message);
  }, []);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('PNG, JPG 또는 WebP 이미지 파일을 선택해 주세요.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage('이미지 파일은 10MB 이하로 선택해 주세요.');
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setImageUrl(objectUrlRef.current);
    setImageStatus('loading');
    setFileName(file.name);
    clearGeneratedResult();
  };

  const handleThemeChange = (themeKey) => {
    setSelectedTheme(themeKey);
    setProductData((current) => ({ ...current, brandTone: POSTER_THEMES[themeKey].tag }));
    clearGeneratedResult();
  };

  const handleGenerate = (event) => {
    event.preventDefault();
    clearGeneratedResult();
    if (!productData.productName.trim() || !productData.productDescription.trim()) {
      setErrorMessage('제품명과 제품 설명을 입력해 주세요.');
      return;
    }
    if (!imageUrl) {
      setErrorMessage('제품 사진을 선택해 주세요.');
      return;
    }
    if (imageStatus !== 'ready' || !generatorRef.current) {
      setErrorMessage('제품 사진이 준비될 때까지 잠시 기다려 주세요.');
      return;
    }

    try {
      const generatedPosterUrl = generatorRef.current.exportPoster();
      const result = {
        ...productData,
        imageUrl,
        posterUrl: generatedPosterUrl,
        status: 'sample',
        format: 'image/png',
      };
      setPosterUrl(generatedPosterUrl);
      setNotice('포스터를 만들었어요. 이 모듈은 posterUrl을 data URL 형식으로 반환합니다.');
      onPosterReady?.(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '포스터를 만들지 못했습니다.');
    }
  };

  const handleDownload = () => {
    if (!posterUrl) return;
    const filename = generatePosterFilename(productData.productName || 'product');
    if (!downloadPosterUrl(posterUrl, filename)) {
      setErrorMessage('PNG를 저장하지 못했습니다. 포스터를 다시 만들어 주세요.');
      return;
    }
    setNotice('고해상도 PNG 저장을 시작했어요.');
  };

  const ratio = POSTER_RATIOS[selectedRatio];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-[#dfe5dd] bg-white">
        <div className="relative px-5 py-7 sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full bg-[#e6f3e9] blur-2xl" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#ecf6ee] px-3 py-1.5 text-xs font-bold text-[#257346]"><Sparkles className="h-3.5 w-3.5" /> D · AI 포스터 모듈</div>
              <h2 className="text-2xl font-extrabold leading-tight tracking-[-0.04em] text-[#17211b] sm:text-[34px]">제품 정보와 사진으로 홍보 포스터를 구성해요</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#68746c] sm:text-[15px]">제품 형태와 특징을 살려 SNS에 바로 활용할 수 있는 포스터 시안을 만들어 보세요.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-[#e3e8e2] bg-[#fafbf8] px-4 py-3 text-xs font-bold text-[#53645a]"><ShieldCheck className="h-4 w-4 text-[#3c8a59]" /> 샘플 Canvas 렌더러</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,0.78fr)_minmax(520px,1.22fr)] xl:items-start">
        <form onSubmit={handleGenerate} className="space-y-4">
          <ControlCard icon={ImagePlus} title="제품 정보" number="01">
            <FieldLabel htmlFor="product-name" label="제품명" meta={`${productData.productName.length}/50`} />
            <input
              id="product-name"
              required
              maxLength={50}
              value={productData.productName}
              onChange={(event) => handleFieldChange('productName', event.target.value)}
              className="w-full rounded-xl border border-[#dfe5dd] bg-[#fafbf8] px-3.5 py-3 text-sm font-semibold text-[#233027] transition placeholder:text-[#a3ada5] hover:border-[#bdc9bf] focus:border-[#3e8c5d] focus:bg-white focus:outline-none"
              placeholder="예: 수제 과일청"
            />
            <FieldLabel htmlFor="product-description" label="제품 설명" meta={`${productData.productDescription.length}/300`} />
            <textarea
              id="product-description"
              required
              maxLength={300}
              rows={3}
              value={productData.productDescription}
              onChange={(event) => handleFieldChange('productDescription', event.target.value)}
              className="w-full resize-y rounded-xl border border-[#dfe5dd] bg-[#fafbf8] px-3.5 py-3 text-sm leading-6 text-[#233027] transition placeholder:text-[#a3ada5] hover:border-[#bdc9bf] focus:border-[#3e8c5d] focus:bg-white focus:outline-none"
              placeholder="제품의 특징과 쓰임을 간단히 적어 주세요."
            />
            <FieldLabel htmlFor="key-selling-point" label="강조할 특징" meta="선택" />
            <input
              id="key-selling-point"
              maxLength={80}
              value={productData.keySellingPoint}
              onChange={(event) => handleFieldChange('keySellingPoint', event.target.value)}
              className="w-full rounded-xl border border-[#dfe5dd] bg-[#fafbf8] px-3.5 py-3 text-sm text-[#233027] transition placeholder:text-[#a3ada5] hover:border-[#bdc9bf] focus:border-[#3e8c5d] focus:bg-white focus:outline-none"
              placeholder="예: 하나로 간편하게 이어지는 데일리 케어"
            />
            <FieldLabel htmlFor="target-audience" label="주요 고객" meta="선택" />
            <input
              id="target-audience"
              maxLength={60}
              value={productData.targetAudience}
              onChange={(event) => handleFieldChange('targetAudience', event.target.value)}
              className="w-full rounded-xl border border-[#dfe5dd] bg-[#fafbf8] px-3.5 py-3 text-sm text-[#233027] transition placeholder:text-[#a3ada5] hover:border-[#bdc9bf] focus:border-[#3e8c5d] focus:bg-white focus:outline-none"
              placeholder="예: 간편한 샤워 루틴을 찾는 분"
            />
          </ControlCard>

          <ControlCard icon={Upload} title="제품 사진" number="02">
            <label className="group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#b9c8bc] bg-[#f6faf6] p-3 transition hover:border-[#4b9465] hover:bg-[#f0f8f1]">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#d9e5da] bg-white">
                {imageUrl ? <img src={imageUrl} alt="선택한 제품 사진" className="h-full w-full object-cover" /> : <Upload className="h-5 w-5 text-[#4e8b63]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-[#314037]">{fileName}</span>
                <span className="mt-1 block text-[11px] text-[#839087]">PNG, JPG, WebP · 최대 10MB</span>
              </span>
              <Upload className="h-4 w-4 text-[#64806d] transition group-hover:-translate-y-0.5" />
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="sr-only" />
            </label>
            <p className="text-[11px] leading-5 text-[#7a857d]">사진은 이 브라우저에서 처리되며 서버로 업로드하지 않습니다.</p>
          </ControlCard>

          <ControlCard icon={Palette} title="포스터 스타일" number="03">
            <div>
              <FieldLabel label="원하는 분위기" />
              <div className="grid grid-cols-2 gap-2">
                {Object.values(POSTER_THEMES).map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={selectedTheme === theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className={`rounded-xl border p-3 text-left transition ${selectedTheme === theme.id ? 'border-[#3d8b5c] bg-[#f0f8f1] shadow-[0_0_0_1px_#3d8b5c]' : 'border-[#e1e6e0] bg-white hover:border-[#b8c5bb]'}`}
                  >
                    <span className="mb-2 flex gap-1">{theme.bgGradient.map((color) => <span key={color} className="h-3.5 w-3.5 rounded-full border border-black/5" style={{ backgroundColor: color }} />)}</span>
                    <span className="block text-xs font-extrabold text-[#2a382f]">{theme.shortName}</span>
                    <span className="mt-0.5 block text-[10px] text-[#829087]">{theme.tag}</span>
                  </button>
                ))}
              </div>
            </div>
            <FieldLabel label="구도" />
            <div className="grid grid-cols-3 gap-2">
              {Object.values(POSTER_COMPOSITIONS).map((composition) => (
                <button
                  key={composition.id}
                  type="button"
                  aria-pressed={selectedComposition === composition.id}
                  onClick={() => { setSelectedComposition(composition.id); clearGeneratedResult(); }}
                  className={`rounded-xl border px-2 py-3 text-center transition ${selectedComposition === composition.id ? 'border-[#3d8b5c] bg-[#f0f8f1] shadow-[0_0_0_1px_#3d8b5c]' : 'border-[#e1e6e0] bg-white hover:border-[#b8c5bb]'}`}
                >
                  <CompositionMark type={composition.id} active={selectedComposition === composition.id} />
                  <span className="mt-2 block text-[10px] font-extrabold text-[#34433a]">{composition.name}</span>
                  <span className="mt-0.5 block text-[9px] leading-4 text-[#8a968e]">{composition.tag}</span>
                </button>
              ))}
            </div>
            <FieldLabel label="캔버스 크기" />
            <div className="grid grid-cols-3 gap-2">
              {Object.values(POSTER_RATIOS).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selectedRatio === item.id}
                  onClick={() => { setSelectedRatio(item.id); clearGeneratedResult(); }}
                  className={`rounded-xl border px-2 py-3 text-center transition ${selectedRatio === item.id ? 'border-[#173f2b] bg-[#173f2b] text-white' : 'border-[#e1e6e0] bg-white text-[#69766d] hover:border-[#b8c5bb]'}`}
                >
                  <span className="block text-xs font-extrabold">{item.id}</span>
                  <span className="mt-1 block text-[9px] opacity-70">{item.platform}</span>
                </button>
              ))}
            </div>
          </ControlCard>

          <button
            type="submit"
            disabled={imageStatus !== 'ready'}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173f2b] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(23,63,43,0.18)] transition hover:-translate-y-0.5 hover:bg-[#22563b] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {imageStatus === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {imageStatus === 'loading' ? '사진 준비 중' : '포스터 만들기'}
          </button>
          <p className="rounded-xl bg-[#fff8e8] px-3 py-2.5 text-[11px] leading-5 text-[#81672e]">현재는 브라우저에서 샘플 시안을 렌더링합니다. 실제 이미지 모델과 공용 저장소는 아직 연결되지 않았습니다.</p>
        </form>

        <section className="xl:sticky xl:top-6">
          <div className="overflow-hidden rounded-[28px] border border-[#dfe5dd] bg-white shadow-[0_18px_60px_rgba(29,54,38,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6eae5] px-4 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${posterUrl ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                  <h3 className="text-sm font-extrabold text-[#26352b]">포스터 미리보기</h3>
                  <span className="rounded-full bg-[#eef2ed] px-2 py-0.5 text-[10px] font-bold text-[#6f7a72]">{posterUrl ? '결과 준비됨' : '샘플 시안'}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#89928b]">{ratio.width} × {ratio.height}px · {POSTER_THEMES[selectedTheme].shortName} · {POSTER_COMPOSITIONS[selectedComposition].name}</p>
              </div>
            </div>

            <div className="bg-[#eef1ec] p-4 sm:p-7 lg:p-10">
              <PosterGenerator
                ref={generatorRef}
                productData={productData}
                imageUrl={imageUrl}
                selectedTheme={selectedTheme}
                selectedRatio={selectedRatio}
                selectedComposition={selectedComposition}
                onStatusChange={handleImageStatus}
              />
            </div>

            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-2 text-[11px] text-[#728078]">
                {posterUrl ? <><Check className="h-4 w-4 text-[#3c8a59]" /> posterUrl 출력 준비 완료</> : <><ShieldCheck className="h-4 w-4 text-[#3c8a59]" /> 생성하면 PNG를 저장할 수 있어요.</>}
              </div>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!posterUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173f2b] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-[#22563b] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              >
                <Download className="h-4 w-4" /> PNG로 저장
              </button>
            </div>
          </div>

          {errorMessage && <p className="mt-3 flex items-start gap-2 rounded-xl border border-[#efd7d2] bg-[#fff4f1] p-3 text-xs leading-5 text-[#934d43]" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{errorMessage}</p>}
          {notice && <p className="mt-3 rounded-xl border border-[#d7e7da] bg-[#edf7ef] p-3 text-xs leading-5 text-[#42664d]" role="status" aria-live="polite">{notice}</p>}
          {imageStatus === 'error' && !errorMessage && <p className="mt-3 rounded-xl border border-[#efd7d2] bg-[#fff4f1] p-3 text-xs leading-5 text-[#934d43]">제품 사진을 다시 선택해 주세요.</p>}
        </section>
      </div>
    </div>
  );
}

function ControlCard({ icon: Icon, title, number, children }) {
  return (
    <section className="rounded-[22px] border border-[#dfe5dd] bg-white p-4 shadow-[0_8px_28px_rgba(32,54,39,0.04)] sm:p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#28372d]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#eff5ef] text-[#3b8055]"><Icon className="h-4 w-4" /></span>{title}</h3>
        <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#a2aca5]">{number}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FieldLabel({ htmlFor, label, meta }) {
  return <div className="flex items-center justify-between gap-3"><label htmlFor={htmlFor} className="text-xs font-bold text-[#46544a]">{label}</label>{meta && <span className="text-[10px] font-medium text-[#99a39c]">{meta}</span>}</div>;
}

function CompositionMark({ type, active }) {
  const color = active ? '#3d8b5c' : '#a9b3ac';
  return (
    <span className="mx-auto flex h-8 w-6 overflow-hidden rounded-[5px] border bg-white" style={{ borderColor: color }} aria-hidden="true">
      {type === 'vertical' && <span className="m-1 w-full rounded-[2px]" style={{ background: `linear-gradient(to bottom, ${color} 0 22%, transparent 22% 30%, ${color} 30% 100%)`, opacity: .75 }} />}
      {type === 'split' && <span className="m-1 w-full rounded-[2px]" style={{ background: `linear-gradient(to right, transparent 0 38%, ${color} 38% 100%)`, boxShadow: `inset 4px 0 0 ${color}33` }} />}
      {type === 'editorial' && <span className="m-1 w-full rounded-[2px]" style={{ background: `linear-gradient(to bottom, ${color} 0 58%, transparent 58% 72%, ${color} 72% 83%, transparent 83%)`, opacity: .75 }} />}
    </span>
  );
}
