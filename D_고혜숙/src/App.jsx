import React from 'react';
import { PosterModule } from './poster';
import { Layers3, Sparkles } from 'lucide-react';

export function App() {
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#17211b] font-sans selection:bg-emerald-200">
      <header className="sticky top-0 z-40 border-b border-[#dfe5dd] bg-[#f7f8f4]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#173f2b] text-white shadow-sm">
              <Sparkles className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#173f2b] sm:text-base">홍보 잇다</h1>
              <p className="text-[11px] font-medium text-[#78837b]">D · AI 포스터 모듈</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-[#dfe5dd] bg-white px-3 py-1.5 text-xs font-semibold text-[#516057] sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
            포스터 스튜디오
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PosterModule />
      </main>

      <footer className="border-t border-[#dfe5dd] bg-white/60">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-6 text-xs text-[#78837b] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="flex items-center gap-2"><Layers3 className="h-4 w-4" /> 홍보 잇다 · Poster Studio</p>
          <p>제품 정보와 사진을 포스터 시안으로 연결합니다.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
