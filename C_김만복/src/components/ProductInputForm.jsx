import { useEffect, useId, useRef, useState } from "react";
import "./ProductInputForm.css";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SAMPLE_PRODUCT_IMAGE = `${import.meta.env.BASE_URL}images/choicell-all-in-one-shampoo.png`;

const initialValues = {
  productName: "초이셀 올인원 샴푸",
  productDescription:
    "두피와 모발을 한 번에 깨끗하게 관리하는 자연 유래 성분의 프리미엄 올인원 샴푸입니다.",
  targetAudience: "건강한 두피와 모발 관리를 원하는 성인",
  keyFeatures: "올인원 케어, 자연 유래 성분, 프리미엄 향",
  brandTone: "natural",
};

export default function ProductInputForm({ onSubmit }) {
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [values, setValues] = useState(initialValues);
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(SAMPLE_PRODUCT_IMAGE);
  const [errors, setErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const updateValue = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const selectPhoto = (file) => {
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setErrors((current) => ({
        ...current,
        photo: "JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.",
      }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((current) => ({
        ...current,
        photo: "사진 용량은 10MB 이하여야 합니다.",
      }));
      return;
    }

    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrors((current) => ({ ...current, photo: "" }));
  };

  const removePhoto = () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPhoto(null);
    setPreviewUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = () => {
    const nextErrors = {};

    if (!values.productName.trim()) {
      nextErrors.productName = "제품명을 입력해주세요.";
    } else if (values.productName.trim().length > 50) {
      nextErrors.productName = "제품명은 50자 이하로 입력해주세요.";
    }

    if (!values.productDescription.trim()) {
      nextErrors.productDescription = "제품 설명을 입력해주세요.";
    } else if (values.productDescription.trim().length < 10) {
      nextErrors.productDescription = "제품 설명을 10자 이상 입력해주세요.";
    }

    if (!previewUrl) nextErrors.photo = "제품 사진을 업로드해주세요.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const payload = {
      productName: values.productName.trim(),
      productDescription: values.productDescription.trim(),
      targetAudience: values.targetAudience.trim(),
      keyFeatures: values.keyFeatures
        .split(",")
        .map((feature) => feature.trim())
        .filter(Boolean),
      brandTone: values.brandTone || "auto",
      photo,
      photoUrl: photo ? "" : previewUrl,
      status: "INPUT_COMPLETED",
    };

    try {
      setIsSubmitting(true);
      if (onSubmit) {
        await onSubmit(payload);
      } else {
        console.info("Product input payload:", payload);
      }
    } catch (error) {
      setErrors((current) => ({
        ...current,
        submit: error?.message || "제품 정보를 전달하지 못했습니다.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="product-input-page">
      <section className="product-input-shell" aria-labelledby={`${inputId}-title`}>
        <div className="product-input-intro">
          <span className="product-input-badge">AI PROMO STUDIO</span>
          <h1 id={`${inputId}-title`}>제품의 매력을 알려주세요</h1>
          <p>
            제품 정보와 사진을 입력하면 AI가 홍보문구, 포스터, 광고영상으로
            만들어드립니다.
          </p>

          <ol className="product-input-steps" aria-label="콘텐츠 생성 단계">
            <li className="is-current"><b>1</b><span>제품 정보</span></li>
            <li><b>2</b><span>AI 콘텐츠 생성</span></li>
            <li><b>3</b><span>결과 확인</span></li>
          </ol>
        </div>

        <form className="product-input-card" onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor={`${inputId}-name`}>제품명 <em>*</em></label>
            <input
              id={`${inputId}-name`}
              name="productName"
              value={values.productName}
              onChange={updateValue}
              maxLength={50}
              placeholder="예: 초이셀 올인원 샴푸"
              aria-invalid={Boolean(errors.productName)}
            />
            <div className="field-meta">
              <span className="field-error">{errors.productName}</span>
              <span>{values.productName.length}/50</span>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor={`${inputId}-description`}>제품 설명 <em>*</em></label>
            <textarea
              id={`${inputId}-description`}
              name="productDescription"
              value={values.productDescription}
              onChange={updateValue}
              maxLength={500}
              rows={5}
              placeholder="제품의 특징, 장점, 재료, 사용법 등을 입력해주세요."
              aria-invalid={Boolean(errors.productDescription)}
            />
            <div className="field-meta">
              <span className="field-error">{errors.productDescription}</span>
              <span>{values.productDescription.length}/500</span>
            </div>
          </div>

          <div className="field-row">
            <div className="field-group">
              <label htmlFor={`${inputId}-target`}>주요 고객층</label>
              <input
                id={`${inputId}-target`}
                name="targetAudience"
                value={values.targetAudience}
                onChange={updateValue}
                placeholder="예: 건강에 관심 있는 20~40대"
              />
            </div>

            <div className="field-group">
              <label htmlFor={`${inputId}-tone`}>홍보 분위기</label>
              <select
                id={`${inputId}-tone`}
                name="brandTone"
                value={values.brandTone}
                onChange={updateValue}
              >
                <option value="">AI 자동 추천</option>
                <option value="natural">자연스럽고 건강한</option>
                <option value="premium">고급스럽고 전문적인</option>
                <option value="friendly">친근하고 따뜻한</option>
                <option value="trendy">트렌디하고 활기찬</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor={`${inputId}-features`}>핵심 특징</label>
            <input
              id={`${inputId}-features`}
              name="keyFeatures"
              value={values.keyFeatures}
              onChange={updateValue}
              placeholder="예: 올인원 케어, 자연 유래 성분, 프리미엄 향 (쉼표로 구분)"
            />
          </div>

          <div className="field-group">
            <label htmlFor={`${inputId}-photo`}>제품 사진 <em>*</em></label>
            <input
              ref={fileInputRef}
              id={`${inputId}-photo`}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => selectPhoto(event.target.files?.[0])}
            />

            {!previewUrl ? (
              <button
                type="button"
                className={`photo-dropzone ${isDragging ? "is-dragging" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  selectPhoto(event.dataTransfer.files?.[0]);
                }}
              >
                <span className="upload-icon" aria-hidden="true">↑</span>
                <strong>제품 사진을 업로드하세요</strong>
                <small>클릭하거나 파일을 끌어 놓으세요</small>
                <small>JPG · PNG · WebP / 최대 10MB / 세로형 권장</small>
              </button>
            ) : (
              <div className="photo-preview">
                <img src={previewUrl} alt="업로드한 제품 미리보기" />
                <div>
                  <strong>{photo?.name || "초이셀 올인원 샴푸 샘플 이미지"}</strong>
                  <small>
                    {photo
                      ? `${(photo.size / 1024 / 1024).toFixed(2)}MB`
                      : "프로젝트 기본 제품 이미지"}
                  </small>
                  <button type="button" onClick={removePhoto}>사진 삭제</button>
                </div>
              </div>
            )}
            {errors.photo && <span className="field-error">{errors.photo}</span>}
          </div>

          {errors.submit && <p className="submit-error" role="alert">{errors.submit}</p>}

          <button className="submit-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "제품 정보를 전달하는 중..." : "AI로 홍보 콘텐츠 만들기"}
            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>
        </form>
      </section>
    </main>
  );
}
