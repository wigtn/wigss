/**
 * GET  /api/settings — 현재 설정
 * POST /api/settings — provider/모델 갱신 (현재 Claude 모델만 변경 가능)
 */
import { NextRequest, NextResponse } from 'next/server';
import { publicSettings, writeSettings, type WigssSettings } from '@/lib/settings';

export async function GET() {
  return NextResponse.json({ success: true, data: publicSettings() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patch: Partial<WigssSettings> = {};
    if (typeof body.claudeModel === 'string' && body.claudeModel.trim()) patch.claudeModel = body.claudeModel.trim();
    writeSettings(patch);
    return NextResponse.json({ success: true, data: publicSettings() });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: e instanceof Error ? e.message : 'invalid' } },
      { status: 400 }
    );
  }
}
