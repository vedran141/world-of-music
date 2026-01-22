// api/analytics.js
const { google } = require('googleapis');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse Service Account credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const authClient = await auth.getClient();
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: authClient });

    // Get request body (report parameters from frontend)
    const { dateRanges, dimensions, metrics, limit } = req.body;

    // Run report
    const response = await analyticsData.properties.runReport({
      property: 'properties/521095907',
      requestBody: {
        dateRanges,
        dimensions,
        metrics,
        limit: limit || 10
      }
    });

    // Return data
    res.status(200).json(response.data);

  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
};
