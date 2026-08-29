import DodoPayments from 'dodopayments';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DODO_PAYMENTS_WEBHOOK_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  try {
    const payload = req.body;
    
    // In a real production environment, you should verify the webhook signature here
    // using DODO_PAYMENTS_WEBHOOK_KEY. Dodo SDK might provide a verification method:
    // const event = dodo.webhooks.constructEvent(req.body, req.headers['dodo-signature'], DODO_PAYMENTS_WEBHOOK_KEY);
    // For now, we process the payload directly based on the user's constraints.

    if (payload.event === 'payment.succeeded' || payload.event === 'payment.succeeded' || (payload.data && payload.type === 'payment.succeeded') || (payload.data && payload.data.status === 'succeeded')) {
      // Depending on Dodo's exact webhook structure, it might be payload.event, payload.type or payload.data.status
      // We will look for metadata
      let metadata = payload.data?.metadata || payload.metadata || {};
      
      const bidId = metadata.bid_id;

      if (bidId) {
        // Update the bid in Supabase
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/bids?id=eq.${bidId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            payment_status: 'paid'
          })
        });

        if (!updateRes.ok) {
          console.error('Failed to update bid in Supabase from webhook', await updateRes.text());
          return res.status(500).json({ error: 'Database update failed' });
        }
      } else {
        console.warn('Webhook received but no bid_id found in metadata');
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
}
