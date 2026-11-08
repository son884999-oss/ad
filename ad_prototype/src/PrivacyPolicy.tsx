// 개인정보 처리방침 (draft, 2026-10-19) shown from 회원가입 and the menu. Not legal advice: the team checks the
// processors, overseas transfers and the contact line before a public service ([회원가입], docs/나중에_할일.md).
export const PRIVACY_VERSION = "2026-10-19"

export default function PrivacyPolicy() {
  return (
    <div className="privacy-policy">
      <p>홍보잇다(이하 "서비스")는 개인정보 보호법에 따라 이용자의 개인정보를 아래와 같이 처리합니다. 시행일: {PRIVACY_VERSION} · 최종 수정일: 2026-11-08</p>
      <h3>1. 모으는 정보와 목적</h3>
      <ul>
        <li><b>회원가입 / 로그인:</b> 이메일로 가입하는 경우 이메일 주소와 비밀번호를, 카카오 또는 Google로 가입하는 경우 해당 서비스에서 제공하는 계정 식별자·닉네임·이메일 주소를 처리합니다. 비밀번호는 Supabase 인증 서비스를 통해 가입·로그인 처리에 사용합니다. 목적: 본인 확인, 내 홍보물 보관. Google 로그인으로 받은 계정 정보는 회원 식별과 계정별 저장에 사용하며, Gmail·Google Drive의 자료를 조회하는 권한은 요청하지 않습니다.</li>
        <li><b>내 홍보물:</b> 올린 사진, 입력한 가게·제품 정보, 만든 포스터·영상·홍보 글. 목적: 다른 기기에서도 다시 보기.</li>
        <li><b>로그인하지 않으면</b> 홍보물 목록은 이 기기에 저장됩니다. 다만 AI 사진 분석·홍보 글 작성·배경 바꾸기를 요청하면, 처리에 필요한 사진과 입력 내용은 서버와 아래 AI 서비스에 전송됩니다.</li>
      </ul>
      <h3>2. 보관 기간</h3>
      <p>계정 정보와 서버에 저장된 홍보물은 회원 탈퇴 또는 삭제 요청이 정상 처리되면 운영 저장소에서 삭제합니다. 처리에 실패한 경우 화면의 안내에 따라 다시 요청할 수 있습니다. 기기에 내려받은 파일이나 다른 기기의 브라우저에 남은 자료까지 원격으로 삭제되는 것은 아닙니다. 법령에 별도 보관 의무가 있는 정보는 해당 의무에 따라 보관합니다.</p>
      <h3>3. 처리를 맡기는 곳 (처리 위탁·국외 이전)</h3>
      <ul>
        <li><b>Supabase</b> — 회원 정보·내 홍보물 저장 (서버 위치: 인도 뭄바이, ap-south-1)</li>
        <li><b>Vercel</b> — 서비스 운영(웹 서버)</li>
        <li><b><span className="nw">Google(Gemini)·</span><span className="nw">코디세이 COPA</span><span className="nw">(Anthropic Claude)</span></b> — 홍보 글 작성, 사진 분석, (선택 시) 배경 바꾸기를 위해 사진과 입력 내용을 보냅니다. COPA는 코디세이 교육 과정(이노베이션아카데미 운영)이 제공하는 AI 연결 서비스입니다.</li>
      </ul>
      <h3>4. 이용자의 권리</h3>
      <p>언제든지 내 홍보물을 지우거나, 메뉴의 "회원 탈퇴"로 계정과 저장한 모든 홍보물을 지울 수 있습니다. 열람·정정·삭제·처리정지를 요청할 수 있습니다.</p>
      <h3>5. 만 14세 미만</h3>
      <p>회원가입은 만 14세 이상 이용자를 대상으로 합니다.</p>
      <h3>6. 문의</h3>
      <p className="privacy-contact"><span>개인정보 보호책임자: 손용범</span><span>연락처: <span className="privacy-email">hmcf7nz7@naver.com</span></span></p>
    </div>
  )
}
