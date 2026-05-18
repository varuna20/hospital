const { SystemSettings } = require('../models/SystemSettings');

let keepAliveInterval = null;

async function pingServer() {
  try {
    const settings = await SystemSettings.findOne();
    if (!settings?.keepAlive?.enabled) {
      console.log('⚡ Keep-Alive is disabled in system settings.');
      return;
    }

    const pingUrl = settings.keepAlive.url || 'https://hospital-system-t9fq.onrender.com';
    // Append /api/health to ensure we call a lightweight health route
    const healthUrl = pingUrl.endsWith('/api/health') 
      ? pingUrl 
      : `${pingUrl.replace(/\/$/, '')}/api/health`;

    console.log(`📡 [Keep-Alive] Pinging self at: ${healthUrl}`);
    
    const startTime = Date.now();
    const res = await fetch(healthUrl, {
      headers: { 'User-Agent': 'HospitalSystemKeepAlive/3.0' }
    });
    
    const duration = Date.now() - startTime;
    const statusText = res.ok ? 'success' : `failed (HTTP ${res.status})`;

    // Update stats in settings
    await SystemSettings.findOneAndUpdate({}, {
      'keepAlive.lastPing': new Date(),
      'keepAlive.lastPingStatus': statusText
    });

    console.log(`✅ [Keep-Alive] Ping ${statusText} in ${duration}ms`);
  } catch (err) {
    console.error('❌ [Keep-Alive] Ping failed:', err.message);
    await SystemSettings.findOneAndUpdate({}, {
      'keepAlive.lastPing': new Date(),
      'keepAlive.lastPingStatus': `failed (${err.message.slice(0, 50)})`
    }).catch(() => {});
  }
}

function startKeepAliveScheduler() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);

  // Run ping check immediately upon start
  pingServer();

  // Run self-ping every 5 minutes (300,000 ms)
  // This completely resets Render's 15-minute idle countdown
  keepAliveInterval = setInterval(pingServer, 5 * 60 * 1000);
  
  console.log('⚡ [Keep-Alive] Continuous Self-Ping Scheduler initialized (5-minute interval)');
}

module.exports = { startKeepAliveScheduler, pingServer };
