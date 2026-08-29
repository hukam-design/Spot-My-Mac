export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables' });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/spots?select=*,bids(id,brand_name,bid_amount,logo_url,payment_status,status)&order=id.asc`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.statusText}`);
    }

    const dbSpots = await response.json();
    
    // UI Metadata
    const SPOTS_META = [
      { id:1,  num:'1',  name:'Top left',                  size:'L', dims:'9.5 × 5.5 cm', base_bid:418 },
      { id:2,  num:'2',  name:'Top center',                 size:'L', dims:'9.5 × 5.5 cm', base_bid:660 },
      { id:3,  num:'3',  name:'Top right',                  size:'L', dims:'9.5 × 5.5 cm', base_bid:418 },
      { id:4,  num:'4',  name:'Mid left A',                 size:'S', dims:'4 × 5 cm',     base_bid:139 },
      { id:5,  num:'5',  name:'Mid left B',                 size:'S', dims:'4 × 5 cm',     base_bid:157 },
      { id:6,  num:'6',  name:'Center — beside Apple logo', size:'L', dims:'9.5 × 5 cm',   base_bid:555 },
      { id:7,  num:'7',  name:'Mid right A',                size:'S', dims:'4 × 5 cm',     base_bid:157 },
      { id:8,  num:'8',  name:'Mid right B',                size:'S', dims:'4 × 5 cm',     base_bid:139 },
      { id:9,  num:'9',  name:'Bottom left',                size:'L', dims:'9.5 × 5.5 cm', base_bid:209 },
      { id:10, num:'10', name:'Bottom center',              size:'L', dims:'9.5 × 5.5 cm', base_bid:261 },
      { id:11, num:'11', name:'Bottom right',               size:'L', dims:'9.5 × 5.5 cm', base_bid:210 },
    ];

    const mappedSpots = SPOTS_META.map(meta => {
      const dbSpot = dbSpots.find(s => s.id === meta.id);
      let bid = meta.base_bid;
      let holder = '';
      let bidsCount = 0;
      let logo_url = null;
      let underReview = null;

      if (dbSpot) {
        const completedBids = (dbSpot.bids || []).filter(b => b.status === 'approved');
        bidsCount = completedBids.length;

        if (completedBids.length > 0) {
          const highestBid = completedBids.reduce((max, b) => (b.bid_amount > max.bid_amount ? b : max), completedBids[0]);
          if (highestBid.bid_amount > bid) {
            bid = highestBid.bid_amount;
          }
          holder = highestBid.brand_name;
          logo_url = highestBid.logo_url || null;
        }

        // Calculate underReview by finding highest bid that is paid but not yet approved (pending)
        const reviewBids = (dbSpot.bids || []).filter(b => b.payment_status === 'paid' && (b.status === 'pending' || b.status === 'review'));
        if (reviewBids.length > 0) {
          const highestReviewBid = reviewBids.reduce((max, b) => (b.bid_amount > max.bid_amount ? b : max), reviewBids[0]);
          if (highestReviewBid.bid_amount > bid) {
            underReview = highestReviewBid.bid_amount;
          }
        }
      }

      return {
        id: meta.id,
        num: meta.num,
        name: meta.name,
        size: meta.size,
        dims: meta.dims,
        bid,
        holder,
        logo_url,
        bids: bidsCount,
        underReview
      };
    });

    return res.status(200).json(mappedSpots);
  } catch (error) {
    console.error('Error fetching spots:', error);
    return res.status(500).json({ error: 'Failed to fetch spots' });
  }
}
