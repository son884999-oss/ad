// 개인정보 처리방침 (draft, 2026-10-19) shown from 회원가입 and the menu. Not legal advice: the team checks the
// processors, overseas transfers and the contact line before a public service ([회원가입], docs/나중에_할일.md).
export const PRIVACY_VERSION = "2026-10-19"

export default function PrivacyPolicy() {
  return (
    <div className="privacy-policy">
      <p>홍보잇다(이하 "서비스")는 개인정보 보호법에 따라 이용자의 개인정보를 아래와 같이 처리합니다. 시행일: {PRIVACY_VERSION}</p>
      <h3>1. 모으는 정보와 목적</h3>
      <ul>
        <li><b>회원 가입·로그인:</b> 이메일 주소, (카카오·Google로 가입하면) 해당 서비스가 알려 주는 계정 식별자·닉네임·이메일. 목적: 본인 확인, 내 홍보물 보관.</li>
        <li><b>내 홍보물:</b> 올린 사진, 입력한 가게·제품 정보, 만든 포스터·영상·홍보 글. 목적: 다른 기기에서도 다시 보기.</li>
        <li><b>로그인하지 않으면</b> 홍보물은 이 기기에만 저장되고 서버에 보관하지 않습니다.</li>
      </ul>
      <h3>2. 보관 기간</h3>
      <p>회원 탈퇴 또는 홍보물 삭제 시 바로 지웁니다. 법령에 따로 보관 의무가 있는 경우에는 그 기간 동안 보관합니다.</p>
      <h3>3. 처리를 맡기는 곳 (처리 위탁·국외 이전)</h3>
      <ul>
        <li><b>Supabase</b> — 회원 정보·내 홍보물 저장 (서버 위치: 프로젝트 생성 시 선택한 지역)</li>
        <li><b>Vercel</b> — 서비스 운영(웹 서버)</li>
        <li><b>Google(Gemini)·기관 제공 AI(Claude)</b> — 홍보 글 작성, 사진 분석, (선택 시) 배경 바꾸기를 위해 사진과 입력 내용을 보냅니다.</li>
      </ul>
      <h3>4. 이용자의 권리</h3>
      <p>언제든지 내 홍보물을 지우거나, 메뉴의 "회원 탈퇴"로 계정과 저장한 모든 홍보물을 지울 수 있습니다. 열람·정정·삭제·처리정지를 요청할 수 있습니다.</p>
      <h3>5. 만 14세 미만</h3>
      <p>만 14세 미만은 가입할 수 없습니다.</p>
      <h3>6. 문의</h3>
      <p>개인정보 보호책임자: (팀에서 기입) · 연락처: (팀에서 기입)</p>
    </div>
  )
}
