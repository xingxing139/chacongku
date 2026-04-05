const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // 设置跨域头，允许你的前端访问
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: '请输入号码' });
  }

  // 从 Vercel 环境变量读取（你在上一步 Settings 里填的标签名）
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const cleanPhone = phone.replace(/\D/g, '');

  try {
    // 1. 查重
    const { data, error: qErr } = await supabase
      .from('benz_check_system')
      .select('customer_phone')
      .eq('customer_phone', cleanPhone)
      .maybeSingle();

    if (qErr) throw qErr;

    if (data) {
      return res.status(200).json({ status: 'exists' });
    }

    // 2. 录入
    const { error: iErr } = await supabase
      .from('benz_check_system')
      .insert([{ customer_phone: cleanPhone }]);

    if (iErr) throw iErr;

    return res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '服务器内部错误', details: err.message });
  }
};
