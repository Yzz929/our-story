// 用 DoH 绕过本机 DNS，确认这个域名在公网上到底存不存在
const names = ['hyqpsbwcibrajxgxglrf.supabase.co', 'supabase.co', 'zzzzdoesnotexistzzzz.supabase.co'];

for (const n of names) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${n}&type=A`, {
      headers: { accept: 'application/dns-json' },
    });
    const j = await r.json();
    console.log(n, '→ Status', j.Status, j.Answer ? j.Answer.map((a) => a.data).join(', ') : '(无记录)');
  } catch (e) {
    console.log(n, 'DoH FAIL', e.message);
  }
}
