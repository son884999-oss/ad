# 초안 검증 결과

- 검증일: 2026-10-11
- 환경: Windows PowerShell, Node.js v24.21.0
- 명령: `node --test --test-reporter=tap`
- 결과: **32개 통과, 실패 0, 건너뜀 0**
- 실행 원문: [tests/results.tap](tests/results.tap)
- 예시 실행: `node examples/run.js --save` — 키·네트워크 없이 제품 3종 생성 성공
- 예시 결과: [examples/rules-output.json](examples/rules-output.json)

| 검증 항목 | 결과 |
| --- | --- |
| 필수값 누락·공백·잘못된 타입 | TypeError 전달 |
| 선택값 생략·null·공백 | 차분한 기본값으로 생성 |
| 미분류 제품 | 일반 제품 연출 |
| 식품·화장품·생활용품 | 제품별 콘셉트와 강조점 차이 확인 |
| 분위기 변경 | 고급·밝음·따뜻함·기본 매핑 확인 |
| 출력 계약 | 영어 문자열, `{ videoPrompt }`, 고정 문장 순서 확인 |
| 팀장 연결 예시 | 원래 imageUrl과 prompt 문자열을 대체 generateVideo 함수에 전달 |
| 공통 보존 | 느린 연속 10초 카메라, 형태·색상·라벨·로고와 배경 유지 문장 확인 |
| Gemini 설정 | 키·모델 누락 시 네트워크 요청 전 오류 |
| Gemini 이미지 전송 | PNG 실제 바이트의 base64와 제품 메타데이터 포함 확인 |
| 이미지 오류 | 404, HTML, 빈 이미지, 8 MiB 초과, 시간 초과 처리 |
| AI 오류 | HTTP 429, 네트워크 오류, API 오류, 차단·잘림 처리 |
| AI 응답 검증 | 빈 응답, 잘못된 JSON, 필드 누락, 영어 외 문자, 길이 초과 처리 |
| 오류 시 동작 | 규칙 방식 자동 대체 없음 |

다운로드 시간 초과에 사용되는 DOMException의 code가 숫자인 경우를 테스트에서 발견하고 타입 확인을 추가했다. 수정 후 전체 테스트가 통과했다. 테스트 실행 시 샌드박스의 자식 프로세스 제한(`spawn EPERM`)이 발생하여 허용된 권한으로 재실행했다.

Gemini 테스트는 fetch 대체 응답과 작은 PNG fixture를 사용한 전송·오류 검증이다. 실제 Gemini 서비스 호출, 제품 사진 3종의 시각 분석, 팀장 실제 영상 API, 결과 영상 길이·비율·해상도·사진 충실도는 **미검증**이다. 키와 사진이 준비되면 README의 Gemini 절차로 추가 확인한다.
