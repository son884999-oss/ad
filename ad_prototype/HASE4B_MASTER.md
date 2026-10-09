# PHASE 4-B — BRAND ASSET EXPANSION & AUTONOMOUS UI/UX REFINEMENT
## ABSOLUTE PRIORITY — INTUITIVE UX, VISUAL CLARITY & ACCESSIBILITY

The highest priority of Phase 4-B is NOT asset quantity, illustration richness, or decorative beauty.

The absolute highest priority is creating an immediately understandable, visually clear, mobile-first user experience.

Follow this strict priority hierarchy:

1. **Intuitive UX — Immediate understanding of what to do next**
2. **Visual clarity — Legibility, visibility, and clear information hierarchy**
3. **Senior-friendly accessibility and mobile usability**
4. **Functional reliability and preservation of existing features**
5. **Professional brand consistency**
6. **Purposeful visual asset production and integration**
7. **Decorative refinement and visual polish**

### Three-Second Comprehension Principle

A first-time user should understand within approximately three seconds:

- What 홍보잇다 does
- Where to begin
- Which action to take next

Treat this as a design evaluation heuristic, not a guaranteed or scientifically verified measurement.

### Mandatory Visual Clarity Rules

- Primary buttons must be immediately distinguishable.
- Essential instructions must remain readable.
- Use strong text-background contrast.
- Avoid visually competing illustrations.
- Maintain clear spacing and grouping.
- Avoid unnecessary complexity.
- Do not overload screens with illustrations, cards, or decorative graphics.
- Ensure the main action remains clearly visible on mobile.
- Optimize typography and touch targets for senior users.
- Make errors, completion states, and next actions understandable without additional explanation.

### Asset Placement Restrictions

The requirement to create at least 20 visual assets does NOT mean that all assets must be displayed simultaneously.

Assets may be used across different screens, states, and responsive layouts.

Only integrate an asset when it improves:

- Comprehension
- Navigation
- User confidence
- Brand recognition
- Visual communication

Human characters must remain supporting elements.

The product interface, generated promotional materials, and primary actions must dominate the visual hierarchy.

### Conflict Resolution

When visual beauty conflicts with usability, ALWAYS prioritize usability.

When decorative assets reduce clarity, remove, simplify, or reposition them.

When an illustration competes with a primary CTA, the CTA takes priority.

When a mobile screen becomes visually crowded, reduce decorative density.

A visually simpler interface with excellent usability is preferable to a beautiful but confusing interface.

### Continuous Verification

During every Phase 4-B refinement cycle, evaluate:

1. Can a first-time user identify the next action immediately?
2. Is the primary CTA visually prominent?
3. Is Korean text readable on a mobile screen?
4. Are the illustrations supporting rather than dominating the UI?
5. Does the layout remain intuitive for senior users?
6. Are photos, description inputs, results, and downloads easy to locate?

Do not consider Phase 4-B complete if major clarity or usability issues remain, even if the 20-asset production target has been achieved.

All review findings and progress reports must be written in Korean.
Read `AGENTS.md`, `DESIGN_MASTER.md`, and the completed Phase 4-A branding work.

## MISSION

Transform 홍보잇다 into a professionally branded, visually cohesive, mobile-first marketing platform.

Use the logo direction approved by the user during Phase 4-A.

Do not replace the approved logo concept or change the official brand name.

Preserve all existing application functionality.

## 1. BRAND SYSTEM FINALIZATION

Refine the approved logo and create its production variants:

- Primary combined logo
- Horizontal logo
- Korean wordmark
- Symbol-only logo
- Monochrome logo
- Inverted logo
- Favicon
- Mobile app icon

Use a warm orange-centered palette, supported by accessible neutral and complementary colors.

Preserve the Möbius-inspired connection concept.

Ensure the exact Korean text 홍보잇다 is correctly rendered.

## 2. MANDATORY ASSET PRODUCTION

Create a library of at least 20 distinct, purposeful, production-ready visual assets, including branding variants.

Do not count duplicate files, simple resizing, or format conversions as separate creative assets.

Suggested distribution:

- 8 logo and brand variants
- 4 homepage and service illustrations
- 4 workflow illustrations
- 4 result, completion, and guidance illustrations
- Additional assets where justified

Use `$imagegen` for high-quality original illustrations when available.

Use SVG for logos, simple icons, and UI graphics when appropriate.

Save production assets under organized paths such as:

`public/assets/branding/`
`public/assets/illustrations/`
`public/assets/icons/`

Create an asset inventory documenting filenames, intended use, and implementation status.

## 3. CRITICAL ART DIRECTION

Follow a SERVICE-FIRST visual design philosophy.

The main visual focus must be:

1. The product and its functionality
2. Promotional posters, videos, and result previews
3. Store environments and interface elements
4. Human characters as supporting elements

Characters should NOT dominate the composition.

Use modern adult characters, generally appearing approximately 25–45 years old, when appropriate.

Avoid oversized human figures, dominant portraits, or elderly-centered hero compositions.

Do not use prominent white-haired elderly characters as the default brand imagery.

People should support the story, not dominate the composition.

The service experience, UI clarity, background environment, and promotional results must remain visually prominent.

Use Corporate Flat Vector Illustration with:

- Warm pastel colors
- Controlled dark-navy outlines
- Clean 2D forms
- Consistent proportions
- Minimal textures
- Mature, professional appearance
- Generous whitespace

Do not allow characters to obscure important interface elements or marketing content.

## 4. ACTUAL UI INTEGRATION

Integrate the approved branding and created assets directly into the existing React application.

Improve:

- Homepage visual identity
- Hero composition
- Workflow illustrations
- Result previews
- Empty states
- Completion screens
- Marketing-platform presentation
- Onboarding and instructional sections

Replace decorative emojis and weak placeholder graphics with appropriate professional assets.

Do not replace clear, accessible functional icons unnecessarily.

Prioritize meaningful visual improvement over decorative density.

## 5. MOBILE-FIRST REFINEMENT

Test the application at:

320px, 375px, 390px, 430px, 768px, 1024px, and 1440px.

Ensure:

- Clear primary actions
- Readable Korean typography
- Appropriate touch targets
- Balanced asset sizes
- Strong hero composition
- No horizontal overflow
- No overlapping elements
- Accessible forms and navigation
- Clear result and download actions

Do not merely shrink desktop layouts for mobile devices.

## 6. PRESERVE COMPLETED WORK

Do not rebuild completed Phase 3 features without a demonstrated need.

Preserve:

- Photo → Description → Results workflow
- Progress bar and stepper
- Screen transitions
- Touch interactions
- Sound and haptic preferences
- Existing result gallery behavior
- Working integrations and downloads

Only modify these areas when testing reveals actual problems.

## 7. THREE-PERSPECTIVE REVIEW

Review the application as:

A. Senior-User UX Advocate
B. Senior Frontend Engineer
C. Creative Design Director

Identify weaknesses in usability, accessibility, responsive design, functionality, and visual quality.

Implement improvements rather than merely listing recommendations.
### Autonomous Asset Regeneration & Visual Correction

When a visual quality issue is discovered, do not stop after identifying or reporting it.

Determine whether the root cause is:

1. Asset composition or illustration quality
2. Asset size, placement, or cropping
3. Typography, contrast, or layout
4. Responsive behavior
5. Inconsistency with the approved brand identity

First attempt the least disruptive effective correction.

If the existing asset itself is unsuitable, use `$imagegen` to generate an improved version.

Apply the improved asset directly to the appropriate React component.

Then inspect the actual rendered interface again.

If the result remains unsatisfactory, refine the asset or layout and repeat the verification process.

Preserve previous asset versions until the replacement has been verified.

Do not regenerate unrelated assets.

Do not stop after creating an improved image without integrating and testing it.

Prioritize intuitive UX, visual clarity, and senior-friendly accessibility over illustration quantity or decorative complexity.

Continue until the relevant acceptance criteria are met or a genuine technical limitation prevents further improvement.

Report unresolved limitations honestly in Korean.
## 8. ITERATIVE REFINEMENT

Repeat:

Audit → Prioritize → Generate Assets → Implement → Inspect → Test → Refine

Use real rendered screenshots when browser tools are available.

Do not claim visual verification without inspecting actual output.

Continue until the defined deliverables are completed and major quality issues have been resolved.

Do not enter unlimited regeneration loops.

Stop when further changes provide negligible benefit or the environment prevents continued work.

If usage limits interrupt execution, preserve the project and record the next actions. Resume automatically only when the environment supports it.

## 9. TOOL AUTONOMY

Use relevant trusted tools, including:

- `$imagegen`
- Browser inspection
- Playwright
- Figma integrations
- SVG utilities
- Accessibility testing
- React and Tailwind development tools

Install trusted free dependencies when necessary and permitted.

Do not initiate paid API usage, subscriptions, or high-risk actions without explicit approval.

## 10. COMPLETION CRITERIA

Phase 4-B is complete when:

- The approved 홍보잇다 brand identity is integrated.
- At least 20 distinct purposeful assets have been created and saved.
- The major production assets are integrated into appropriate screens.
- Important decorative emojis and weak placeholders have been replaced.
- Human figures remain visually subordinate to the service.
- The mobile homepage is visually coherent and intuitive.
- Major responsive issues have been resolved.
- Core functionality remains operational.
- Available builds and relevant tests pass.
- Actual implementation evidence is available.

Do not treat an arbitrary number of unintegrated images as successful completion.

## 11. KOREAN COMMUNICATION

All user-facing explanations, progress updates, design reviews, and final reports MUST be written in Korean.

Use natural, professional Korean.

Keep programming syntax, file paths, and identifiers in English where appropriate.

All application-facing UI copy must be natural Korean suitable for senior users.

## 12. FINAL REPORT

Provide a Korean report containing:

1. 최종 로고 및 브랜드 적용 결과
2. 제작한 에셋 20개 이상의 목록
3. 에셋 저장 경로 및 적용 위치
4. 교체한 이모지와 임시 그래픽
5. 인물 비중 및 배경 가시성 개선 사항
6. 메인 화면의 디자인 변경 사항
7. 모바일·PC 반응형 검증 결과
8. 기능 및 빌드 테스트 결과
9. 반복 개선 횟수
10. 실제 수정된 파일
11. 남아 있는 문제와 한계

Implement real project changes, not just plans.

The final objective is a professional, cohesive, service-first, mobile-first commercial experience for 홍보잇다.