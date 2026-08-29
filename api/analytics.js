const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Return a dummy successful response so frontend doesn't break if env vars are missing
    return res.status(200).json({ active: 1, total: 1 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Upsert the session
    const { error: upsertError } = await supabase
      .from('visitors')
      .upsert({ session_id: sessionId, last_active_at: new Date().toISOString() });

    if (upsertError) throw upsertError;

    // 2. Get active visitors (active in the last 20 seconds)
    const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
    const { count: activeCount, error: activeError } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true })
      .gte('last_active_at', twentySecondsAgo);

    if (activeError) throw activeError;

    // 3. Get total visitors
    const { count: totalCount, error: totalError } = await supabase
      .from('visitors')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    return res.status(200).json({ active: activeCount || 1, total: totalCount || 1 });
  } catch (error) {
    console.error('Analytics Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
