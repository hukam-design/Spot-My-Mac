import DodoPayments from 'dodopayments';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { 
    SUPABASE_URL, 
    SUPABASE_SERVICE_ROLE_KEY,
    DODO_PAYMENTS_API_KEY,
    DODO_AUCTION_DEPOSIT_PRODUCT_ID,
    APP_BASE_URL
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  if (!DODO_PAYMENTS_API_KEY || !DODO_AUCTION_DEPOSIT_PRODUCT_ID) {
    return res.status(500).json({ error: 'Missing Dodo environment variables' });
  }

  const dodo = new DodoPayments({
    bearerToken: DODO_PAYMENTS_API_KEY,
    environment: process.env.DODO_MODE === 'live' ? 'production' : 'test_mode'
  });

  try {
    const { 
      spot_id, brand_name, email, website, x_handle, bid_amount, 
      logo_base64, logo_name, logo_type 
    } = req.body;

    let logo_url = null;

    // 1. Upload logo to Supabase Storage if provided
    if (logo_base64 && logo_name) {
      // Strip the data URI prefix regardless of MIME type (handles svg+xml, jpeg, png, etc.)
      const base64Data = logo_base64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Derive correct MIME type: prefer what the browser sent, but also
      // normalise svg — browsers may report 'image/svg+xml'
      const mimeType = logo_type || 'image/png';

      const fileName = `${Date.now()}_${logo_name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      const storageUrl = `${SUPABASE_URL}/storage/v1/object/logos/${fileName}`;

      const uploadRes = await fetch(storageUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': mimeType,
          'x-upsert': 'false'
        },
        body: buffer
      });

      if (!uploadRes.ok) {
        const errorBody = await uploadRes.text();
        console.error(`Upload failed [${uploadRes.status} ${uploadRes.statusText}]:`, errorBody);
        throw new Error(`Logo upload failed (${uploadRes.status}): ${errorBody}`);
      }

      logo_url = `${SUPABASE_URL}/storage/v1/object/public/logos/${fileName}`;
    }

    const deposit_amount = Math.floor(bid_amount * 0.2);

    // 2. Insert bid into bids table as pending
    const bidData = {
      spot_id,
      brand_name,
      email,
      website: website || null,
      x_handle: x_handle || null,
      logo_url,
      bid_amount,
      deposit_amount,
      payment_status: 'pending',
      status: 'pending'
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bids`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(bidData)
    });

    if (!insertRes.ok) {
      const errorText = await insertRes.text();
      console.error('Insert error:', errorText);
      throw new Error(`Failed to save bid: ${insertRes.statusText}`);
    }

    const insertedData = await insertRes.json();
    const insertedBid = insertedData[0];

    // 3. Create Dodo Checkout Session
    const returnUrl = APP_BASE_URL ? `${APP_BASE_URL}?success=true` : 'http://localhost:3000/?success=true';
    
    let payment;
    try {
      payment = await dodo.checkoutSessions.create({
        customer: { name: brand_name || 'Anonymous', email: email },
        product_cart: [
          {
            product_id: DODO_AUCTION_DEPOSIT_PRODUCT_ID,
            amount: Math.round(deposit_amount * 100), // explicitly ensure integer in minor units
            quantity: 1,
          }
        ],
        metadata: {
          bid_id: insertedBid.id
        },
        return_url: returnUrl,
      });
    } catch (e) {
      console.error("Dodo checkout create failed:", {
        message: e?.message,
        status: e?.status || e?.response?.status,
        data: e?.response?.data || e?.body || e
      });
      return res.status(500).json({
        error: 'Failed to generate secure checkout link',
        details: e?.message || "unknown_error"
      });
    }

    // 4. Update the bid with the checkout_id
    await fetch(`${SUPABASE_URL}/rest/v1/bids?id=eq.${insertedBid.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ checkout_id: payment.session_id || payment.id }) // checkoutSessions usually return session_id or id
    });
    
    console.log('Dodo checkout response:', payment);

    return res.status(200).json({ 
      success: true, 
      checkout_url: payment.checkout_url || payment.url || payment.link || (payment.data && (payment.data.checkout_url || payment.data.url)) 
    });

  } catch (error) {
    console.error('Error submitting bid:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
