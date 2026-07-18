import { createClient } from '@supabase/supabase-js';

const digits = (s='') => String(s).replace(/[^0-9]/g, '');

// 클라이언트 입력은 신뢰하지 않는다: 알려진 키만, 길이 제한을 걸어 통과시킨다.
const str = (v, max) => (v === null || v === undefined || v === '') ? null : String(v).slice(0, max);

const cleanAnswers = (v) => {
  if (!Array.isArray(v)) return null;
  const rows = v.slice(0, 12).map((a, i) => ({
    no: Number.isFinite(+a?.no) ? +a.no : i + 1,
    area: str(a?.area, 40),
    question: str(a?.question, 300),
    answer: str(a?.answer, 200),
    score: Number.isFinite(+a?.score) ? +a.score : null,
  }));
  return rows.length ? rows : null;
};

const cleanScores = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out = {};
  for (const k of Object.keys(v).slice(0, 10)) {
    const n = +v[k];
    if (Number.isFinite(n)) out[String(k).slice(0, 40)] = Math.max(0, Math.min(100, Math.round(n)));
  }
  return Object.keys(out).length ? out : null;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method not allowed' });
  try {
    const b = req.body || {};
    if (b.company) return res.status(200).json({ ok:true });

    const type = b.type === 'summary_pdf' ? 'summary_pdf' : 'diagnostic';

    if (type === 'diagnostic') {
      if (!b.parent_name || !b.phone) return res.status(400).json({ ok:false, error:'성함과 연락처를 입력해 주세요.' });
      if (!/^01[016789][0-9]{7,8}$/.test(digits(b.phone))) return res.status(400).json({ ok:false, error:'연락처 형식을 확인해 주세요.' });
      if (!b.consent) return res.status(400).json({ ok:false, error:'개인정보 수집·이용 동의가 필요합니다.' });
    } else {
      if (!b.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) return res.status(400).json({ ok:false, error:'이메일을 확인해 주세요.' });
    }

    const row = {
      type,
      parent_name: str(b.parent_name, 100),
      phone: str(b.phone, 30),
      child_grade: str(b.child_grade, 20),
      email: str(b.email, 200),
      result_type: str(b.result_type, 10),
      result_name: str(b.result_name, 60),
      scores: cleanScores(b.scores),
      answers: cleanAnswers(b.answers),
      consent: b.consent === true,
      consent_marketing: b.consent_marketing === true,
      utm_source: b.utm_source || null, utm_medium: b.utm_medium || null,
      utm_campaign: b.utm_campaign || null, utm_content: b.utm_content || null, utm_term: b.utm_term || null,
      referrer: b.referrer || null, page_path: b.page_path || null,
      user_agent: req.headers['user-agent'] || null,
    };

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase env vars missing');
      return res.status(500).json({ ok:false, error:'접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    }
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
    const { error } = await supabase.from('leads').insert(row);
    if (error) { console.error('supabase insert error', error); return res.status(500).json({ ok:false, error:'접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }); }

    if (process.env.SLACK_WEBHOOK_URL) {
      const text = type === 'diagnostic'
        ? `🎯 *새 로드맵 진단 신청*\n• 성함: ${row.parent_name}\n• 연락처: ${row.phone}\n• 학년: ${row.child_grade || '-'}\n• 진단유형: ${row.result_name || '-'} (${row.result_type || '-'})\n• 유입: ${row.utm_source || 'direct'} / ${row.utm_campaign || '-'}`
        : `📩 *요약본 PDF 신청*\n• 이메일: ${row.email}\n• 유입: ${row.utm_source || 'direct'}`;
      fetch(process.env.SLACK_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ text }) }).catch(()=>{});
    }

    if (type === 'summary_pdf' && process.env.RESEND_API_KEY && process.env.SUMMARY_PDF_URL) {
      fetch('https://api.resend.com/emails', {
        method:'POST',
        headers:{ Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          from: process.env.LEAD_NOTIFY_FROM || 'Harris Prep <onboarding@resend.dev>',
          to: b.email,
          subject: '[Harris Prep] 캠프 성공 시크릿 노트 요약본',
          html: `<p>안녕하세요, Harris Prep입니다.</p><p>요청하신 요약본입니다: <a href="${process.env.SUMMARY_PDF_URL}">요약본 다운로드</a></p>`
        })
      }).catch(()=>{});
    }

    if (type === 'summary_pdf' && process.env.KLAVIYO_API_KEY && process.env.KLAVIYO_LIST_ID) {
      fetch(`https://a.klaviyo.com/api/v2/list/${process.env.KLAVIYO_LIST_ID}/subscribe?api_key=${process.env.KLAVIYO_API_KEY}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ profiles:[{ email:b.email }] })
      }).catch(()=>{});
    }

    return res.status(200).json({ ok:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'서버 오류가 발생했습니다.' });
  }
}
