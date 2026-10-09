Read `AGENTS.md`, `DESIGN_MASTER.md`, and all completed work from Phases 1–3.

# PHASE 4 — AUTONOMOUS VISUAL QUALITY REFINEMENT & PROFESSIONAL PRODUCT POLISH

You are the final-stage product quality team responsible for elevating **홍보잇다** to a professional commercial-service standard.

The core redesign and the three-step process flow have already been addressed during Phase 3.

Do NOT restart the design process from scratch.

Your mission is to critically inspect, improve, refine, and validate the existing implementation.

## 1. PRIMARY OBJECTIVE

Transform the current application from a functional redesigned prototype into a visually cohesive, polished, accessible, production-quality experience.

Prioritize:

1. Professional visual quality
2. Original illustration and asset integration
3. Replacement of emojis and low-quality placeholder visuals
4. Strong visual hierarchy and balanced composition
5. Senior-friendly usability
6. Mobile-first refinement
7. Consistency across screens
8. Functional regression prevention

Preserve the exact official brand name: **홍보잇다**.

---

## 2. COMPLETE VISUAL ASSET AUDIT

Inspect the entire application.

Identify:

- Emojis used as visual decorations or functional icons
- Generic placeholder illustrations
- Weak or inconsistent visual graphics
- Unnecessary stock-like visuals
- Sections that lack sufficient visual explanation
- Areas where high-quality illustrations would improve comprehension
- Inconsistent illustration styles
- Poorly sized or awkwardly positioned images
- Excessive blank space or visual clutter

Create an internal asset improvement inventory.

Prioritize improvements by visual impact and user experience.

Do not waste time replacing assets that already meet professional quality standards.

---

## 3. MANDATORY ASSET REPLACEMENT

Replace decorative emojis, placeholder graphics, and low-quality visual substitutes with intentional, professional assets.

Prefer:

- Original Corporate Flat Vector Illustrations
- Consistent SVG iconography
- Purpose-designed UI illustrations
- High-quality visual communication graphics
- Appropriate original image assets

Use the visual style defined in `DESIGN_MASTER.md`.

Keep all visual assets consistent in color, proportions, outlines, and overall appearance.

Do not use a random collection of unrelated illustrations.

Preserve clear semantic icons where they are already appropriate.

Do not replace accessible functional icons with confusing decorative images merely to increase visual richness.

---

## 4. AUTONOMOUS ASSET GENERATION

Actively use `$imagegen` or other available appropriate image-generation capabilities.

Generate additional professional illustrations wherever the application genuinely benefits from them.

Possible targets:

- Supporting homepage illustrations
- Empty states
- Onboarding guidance
- Upload instructions
- Promotional-content explanations
- Result completion illustrations
- Download guidance
- Marketing platform explanation sections

Do not limit yourself to existing assets if their quality or coverage is insufficient.

For every new asset:

1. Determine its UX purpose.
2. Define its placement and composition.
3. Generate the asset.
4. Inspect the output.
5. Refine or regenerate if necessary.
6. Save it inside the project.
7. Integrate it into the actual React application.
8. Verify its appearance on mobile and desktop.

Prefer consistent asset quality over excessive asset quantity.

Do not generate assets solely for decoration.

---

## 5. ADVANCED VISUAL COMPOSITION REVIEW

Critically inspect:

- Homepage visual impact
- Hero illustration prominence
- Typography hierarchy
- Section transitions
- Card alignment
- Whitespace balance
- Color consistency
- Illustration scale
- Visual rhythm
- Primary button prominence
- Image-to-text relationships
- Overall layout professionalism

Avoid generic AI-generated UI patterns.

Challenge unnecessary card repetition and visually monotonous sections.

Make the product feel thoughtfully art-directed rather than automatically assembled.

Apply improvements directly to the project.

---

## 6. THREE-PERSPECTIVE AUTONOMOUS REVIEW

Simulate three independent professional reviewers.

### Reviewer A — Senior-User UX Advocate

Focus on:
- Immediate comprehension
- Clear Korean instructions
- Readable text
- Comfortable touch targets
- Cognitive load
- Navigation simplicity
- Primary action visibility
- Error recovery

### Reviewer B — Senior Frontend Engineer

Focus on:
- Responsive reliability
- Maintainable components
- Asset performance
- Accessibility
- Functional parity
- Loading behavior
- Build integrity
- Regression risks

### Reviewer C — Creative Design Director

Focus on:
- Brand identity
- Illustration quality
- Professional aesthetics
- Visual hierarchy
- Layout balance
- Typography consistency
- Premium product appearance
- Design-reference alignment

Each reviewer should identify concrete weaknesses.

Resolve conflicts using this priority:

Usability → Accessibility → Functional Reliability → Visual Quality → Maintainability.

Do not merely produce theoretical reviews.

Implement meaningful improvements.

---

## 7. ITERATIVE IMPROVEMENT CYCLES

Perform repeated design review and refinement cycles.

Each cycle must:

1. Inspect the actual application.
2. Identify the highest-impact weaknesses.
3. Prioritize meaningful changes.
4. Generate or improve assets if needed.
5. Implement actual code or asset changes.
6. Verify the affected screens.
7. Check that previously working features remain operational.
8. Record what improved and what remains unresolved.

Continue while meaningful improvements can be demonstrated and execution resources permit.

Avoid endless speculative revisions.

Stop when:

- Major usability problems are resolved.
- Visual quality criteria are satisfied.
- Remaining issues are minor or blocked.
- Further changes provide negligible measurable benefit.

If usage limits interrupt execution, preserve the current state and a clear continuation plan.

Resume automatically only when supported by the execution environment.

Do not claim that automatic background execution is available without verification.

---

## 8. MOBILE & SENIOR ACCESSIBILITY

Review the application at representative viewport widths:

- 320px
- 375px
- 390px
- 430px
- 768px
- 1024px
- 1440px

Check:

- Text readability
- Touch targets
- Button visibility
- Image scaling
- Layout spacing
- Navigation clarity
- Input accessibility
- Form readability
- Contrast
- Content overflow
- Layout shifts
- Loading and feedback states

Do not force desktop compositions onto small screens.

Maintain a calm, intuitive user experience.

---

## 9. PRESERVE COMPLETED PHASE 3 WORK

The following areas have already been addressed in earlier phases:

- Main homepage reconstruction
- Hero visual integration
- Three-step user journey
- Photo → Description → Results process flow
- Progress bar or stepper
- Previously resolved 2+1 result-card layout issue

Do not treat these as unimplemented requirements.

Inspect them for quality and regressions.

Improve them only when there is a clear, demonstrable usability or visual-quality benefit.

Do not rebuild working functionality unnecessarily.

---

## 10. TOOLS, PLUGINS & SKILLS

You are authorized to use relevant trusted tools, plugins, MCP integrations, and development skills.

Prioritize:

- `$imagegen`
- Browser-based visual inspection
- Playwright
- Screenshot comparison
- Accessibility evaluation
- SVG and image optimization
- React and Tailwind development tools

Install relevant trusted free dependencies where permitted.

Do not use paid external APIs, initiate subscriptions, or make high-risk permission changes without explicit approval.

Use actual available tools rather than claiming unsupported capabilities.

---

## 11. FUNCTIONAL VERIFICATION

Preserve all existing functional capabilities.

Verify:

- Main input and upload flow
- Description entry
- Content generation workflow
- Result presentation
- Downloads and exports
- Marketing platform selection
- Navigation
- Existing integrations

Run available build and relevant tests.

Do not claim tests passed unless actually executed.

Do not destroy user data, configurations, or working integrations.

---

## 12. MANDATORY KOREAN COMMUNICATION

All user-facing communication must be written in Korean.

This includes:

- Progress updates
- Visual reviews
- Implementation reports
- Asset production summaries
- Testing results
- Final quality assessment

Use natural and professional Korean.

Keep code identifiers, API names, filenames, and programming syntax in English where appropriate.

All actual UI text should use natural Korean suitable for senior users.

---

## 13. FINAL DELIVERABLES

Provide a comprehensive final report in Korean.

Include:

1. 전체 UI/UX 품질 개선 사항
2. 교체한 이모지 및 임시 그래픽
3. 새롭게 생성한 에셋 목록
4. 기존 에셋의 개선 및 재배치 결과
5. 디자인 디렉터 관점 평가
6. 시니어 사용자 관점 평가
7. 개발자 관점 평가
8. 모바일 및 반응형 검증 결과
9. 기능 및 빌드 테스트 결과
10. 수정한 실제 파일 목록
11. 해결되지 않은 문제
12. 추가 작업이 필요할 경우 구체적인 후속 작업

Do not stop at producing suggestions.

Implement the improvements directly in the existing React project.

The final objective is to make **홍보잇다** feel like a professionally art-directed, senior-friendly, mobile-first commercial product rather than a functional prototype.