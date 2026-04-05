const { createClient } = require('@supabase/supabase-js');

// 内存中简易的频率限制（Vercel 每次冷启动会重置，但能挡住绝大多数脚本）
const rateLimitMap = new Map();

module.exports = async (req, res) => {
    // 1. 处理跨域与基础校验
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

    // 2. 获取用户 IP 进行频率限制
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    const userLimit = rateLimitMap.get(ip) || { count: 0, startTime: now };

    // 如果超过 1 分钟，重置计数
    if (now - userLimit.startTime > 60000) {
        userLimit.count = 0;
        userLimit.startTime = now;
    }

    userLimit.count++;
    rateLimitMap.set(ip, userLimit);

    // 🛑 限制条件：1分钟超过 10 次则拦截
    if (userLimit.count > 10) {
        return res.status(429).json({ error: '请求过于频繁，请 1 分钟后再试' });
    }

    const { phone, verifyCode } = req.body;

    // 3. 验证码校验 (简单逻辑：要求前端传来的验证码必须是 2026)
    // 以后你可以根据需要改成更复杂的动态计算
    if (verifyCode !== "2026") {
        return res.status(403).json({ error: '验证码错误，请重新输入' });
    }

    if (!phone) return res.status(400).json({ error: '请输入号码' });

    // 4. 执行 Supabase 逻辑
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const cleanPhone = phone.replace(/\D/g, '');

    try {
        const { data } = await supabase.from('benz_check_system').select('customer_phone').eq('customer_phone', cleanPhone).maybeSingle();
        if (data) return res.status(200).json({ status: 'exists' });

        await supabase.from('benz_check_system').insert([{ customer_phone: cleanPhone }]);
        return res.status(200).json({ status: 'success' });
    } catch (err) {
        return res.status(500).json({ error: '系统繁忙' });
    }
};
