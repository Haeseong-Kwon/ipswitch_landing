import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';

// 대시보드 전용 조회 API. service_role 키는 서버에만 존재하며 클라이언트로 나가지 않는다.
const safeEqual = (a = '', b = '') => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  // 길이가 다르면 timingSafeEqual이 던지므로, 길이 비교도 상수시간처럼 처리한다.
  if (x.length !== y.length) { timingSafeEqual(x, x); return false; }
  return timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Method not allowed' });

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    console.error('DASHBOARD_PASSWORD env var missing');
    return res.status(500).json({ ok:false, error:'대시보드가 아직 설정되지 않았습니다.' });
  }

  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!safeEqual(given, password)) {
    return res.status(401).json({ ok:false, error:'비밀번호가 올바르지 않습니다.' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Supabase env vars missing');
    return res.status(500).json({ ok:false, error:'데이터베이스 설정이 누락되었습니다.' });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 500, 1), 2000);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('supabase select error', error);
      return res.status(500).json({ ok:false, error:'데이터를 불러오지 못했습니다.' });
    }

    return res.status(200).json({ ok:true, leads: data || [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'서버 오류가 발생했습니다.' });
  }
}
