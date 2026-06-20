'use client';

import { useEffect } from 'react';
import { useSettingsStore, type ProviderId } from '@/stores/settings-store';

/**
 * Provider 선택 화면 — wigss 에이전트의 LLM provider를 고른다.
 * 현재 Claude Code 플랜(구독제 OAuth)만 지원. 향후 provider를 추가할 수 있는 골격.
 */
export function ProviderSettings() {
  const s = useSettingsStore();

  useEffect(() => {
    if (s.open) s.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.open]);

  if (!s.open) return null;

  const Provider = ({ id, title, desc }: { id: ProviderId; title: string; desc: string }) => (
    <button
      onClick={() => s.setProvider(id)}
      className={`w-full text-left rounded-md border p-3 mb-2 transition ${
        s.provider === id ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-500'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full border ${s.provider === id ? 'bg-blue-500 border-blue-500' : 'border-zinc-500'}`} />
        <span className="text-sm font-medium text-zinc-100">{title}</span>
      </div>
      <div className="text-xs text-zinc-400 mt-1 ml-5">{desc}</div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => s.setOpen(false)}>
      <div
        className="w-[440px] max-w-[92vw] rounded-lg border border-zinc-700 bg-[#0a0d14] p-5 text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">AI Provider 설정</h2>
          <button onClick={() => s.setOpen(false)} className="text-zinc-500 hover:text-zinc-200 text-lg leading-none">×</button>
        </div>

        <Provider id="claude" title="Claude Code 플랜 (구독제)" desc="로컬 ~/.claude 구독제 OAuth 사용 · 키 입력 불요 · 토큰당 $0" />

        <div className="mt-3 space-y-2">
          <div className="rounded border border-zinc-700 bg-[#11151d] px-3 py-2 text-xs text-zinc-400">
            Claude Code(claude.ai) 구독제 OAuth를 그대로 사용합니다. 별도 키·외부 데몬 불필요.
          </div>
          <label className="block text-xs text-zinc-400 mt-2">Model</label>
          <input
            value={s.claudeModel}
            onChange={(e) => s.setClaudeModel(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-[#11151d] px-2 py-1.5 text-sm font-mono"
          />
        </div>

        <div className="flex items-center justify-end gap-2 mt-4">
          {s.saved && <span className="text-xs text-green-400">✅ 저장됨</span>}
          <button
            onClick={() => s.save()}
            disabled={s.loading}
            className="rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-1.5 text-sm font-semibold"
          >
            {s.loading ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
