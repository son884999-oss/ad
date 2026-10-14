export function toProductFormData(product) {
  const formData = new FormData();
  formData.append("productName", product.productName);
  formData.append("productDescription", product.productDescription);
  formData.append("targetAudience", product.targetAudience || "");
  formData.append("brandTone", product.brandTone || "auto");
  formData.append("keyFeatures", JSON.stringify(product.keyFeatures || []));
  formData.append("photo", product.photo);
  formData.append("status", product.status || "INPUT_COMPLETED");
  return formData;
}

export async function submitProductInput(product, endpoint = "/api/products") {
  const response = await fetch(endpoint, {
    method: "POST",
    body: toProductFormData(product),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "제품 정보 저장에 실패했습니다.");
  }

  return response.json();
}
