const { createClient } = require('@supabase/supabase-js');

const rateLimitMap = new Map();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: '仅支持 POST' });

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();
    const userLimit = rateLimitMap.get(ip) || { count: 0, startTime: now };

    if (now - userLimit.startTime > 60000) {
        userLimit.count = 0;
        userLimit.startTime = now;
    }
    userLimit.count++;
    rateLimitMap.set(ip, userLimit);

    if (userLimit.count > 10) {
        return res.status(429).json({ error: '请求过于频繁，请 1 分钟后再试' });
    }

    // 接收 phone, verifyCode 和新增的 operator (录入人)
    const { phone, verifyCode, operator } = req.body;

    if (verifyCode !== "2026") {
        return res.status(403).json({ error: '验证码错误' });
    }

    if (!phone || !operator) {
        return res.status(400).json({ error: '号码和录入人姓名均为必填' });
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const cleanPhone = phone.replace(/\D/g, '');

    try {
        const { data } = await supabase.from('benz_check_system').select('customer_phone').eq('customer_phone', cleanPhone).maybeSingle();
        if (data) return res.status(200).json({ status: 'exists' });

        // 存入号码的同时，存入录入人姓名
        await supabase.from('benz_check_system').insert([{ 
            customer_phone: cleanPhone,
            created_by: operator 
        }]);
        
        return res.status(200).json({ status: 'success' });
    } catch (err) {
        return res.status(500).json({ error: '系统繁忙' });
    }
};
