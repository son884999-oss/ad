import { useState } from "react";
import ProductInputForm from "./components/ProductInputForm.jsx";
import "./App.css";

export default function App() {
  const [submittedProduct, setSubmittedProduct] = useState(null);

  const handleProductSubmit = async (product) => {
    // 백엔드가 연결되기 전까지 입력 데이터를 화면에서 확인하는 임시 단계입니다.
    // 서버가 준비되면 이 부분을 submitProductInput(product) 호출로 교체합니다.
    await new Promise((resolve) => window.setTimeout(resolve, 600));

    setSubmittedProduct({
      ...product,
      photoPreviewUrl: product.photo
        ? URL.createObjectURL(product.photo)
        : product.photoUrl,
    });
  };

  if (submittedProduct) {
    return (
      <main className="submission-page">
        <section className="submission-card">
          <span className="success-mark" aria-hidden="true">✓</span>
          <p className="eyebrow">입력 완료</p>
          <h1>제품 정보가 준비되었습니다</h1>
          <p className="submission-description">
            다음 단계에서 이 정보를 이용해 홍보문구, 포스터와 광고영상을
            생성할 수 있습니다.
          </p>

          <div className="submission-summary">
            <img src={submittedProduct.photoPreviewUrl} alt="입력한 제품" />
            <div>
              <span>제품명</span>
              <h2>{submittedProduct.productName}</h2>
              <span>제품 설명</span>
              <p>{submittedProduct.productDescription}</p>
              {submittedProduct.targetAudience && (
                <>
                  <span>주요 고객층</span>
                  <p>{submittedProduct.targetAudience}</p>
                </>
              )}
            </div>
          </div>

          <div className="submission-actions">
            <button type="button" className="secondary-button" onClick={() => setSubmittedProduct(null)}>
              다시 입력하기
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => window.alert("다음 담당자의 AI 생성 기능과 연결할 영역입니다.")}
            >
              AI 콘텐츠 생성 단계로 →
            </button>
          </div>
        </section>
      </main>
    );
  }

  return <ProductInputForm onSubmit={handleProductSubmit} />;
}
