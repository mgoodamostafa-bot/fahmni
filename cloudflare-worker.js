/**
 * Cloudflare Worker: Dynamic Link Preview Injection for Fahmni LMS
 * 
 * This worker intercepts crawler requests (WhatsApp, Facebook, Telegram, etc.)
 * and injects the dynamic tenant siteName from Firestore REST API.
 * For normal users, it rewrites the hostname to the main domain "fahmni.me"
 * so Firebase Hosting can serve the request seamlessly.
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url);
  const hostname = url.hostname; // E.g. hossamalsalhy.fahmni.me
  const userAgent = request.headers.get('user-agent') || '';
  
  // 1. Detect if the requester is a social media crawler/bot
  const isCrawler = /facebookexternalhit|twitterbot|whatsapp|telegrambot|slackbot|discordbot|googlebot/i.test(userAgent);
  
  // Only intercept crawlers requesting HTML pages
  const isHtmlRequest = url.pathname === '/' || url.pathname.endsWith('.html') || !url.pathname.includes('.');
  
  if (isCrawler && isHtmlRequest) {
    const parts = hostname.split('.');
    let tenant = null;
    
    // Extract tenant ID from subdomain (e.g. hossamalsalhy.fahmni.me)
    if (hostname !== 'fahmni.me' && hostname !== 'www.fahmni.me' && parts.length >= 3) {
      tenant = parts[0] === 'www' ? null : parts[0];
    }
    
    if (tenant) {
      try {
        // Fetch tenant data directly from Firestore REST API with the custom database ID
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/gen-lang-client-0266961201/databases/ai-studio-17f4701a-a7f4-4ee0-808c-1a71c96228c0/documents/tenants/${tenant}`;
        
        // Use a short timeout of 2 seconds for Firestore to avoid slowing down crawlers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(firestoreUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          // Extract siteName or fallback to name
          const siteName = data.fields?.siteName?.stringValue || data.fields?.name?.stringValue || 'فهمني';
          
          // Fetch the static index.html from Firebase Hosting (via main domain)
          const fetchUrl = new URL(request.url);
          fetchUrl.hostname = "fahmni.me";
          const originResponse = await fetch(fetchUrl, request);
          let html = await originResponse.text();
          
          // Inject dynamic metadata tags
          html = html.replace(/<title>.*?<\/title>/, `<title>${siteName}</title>`);
          html = html.replace(/<meta property="og:title" content=".*?"\s*\/?>/, `<meta property="og:title" content="${siteName}" />`);
          
          // Return the modified HTML to the crawler
          return new Response(html, {
            headers: { 
              'content-type': 'text/html;charset=UTF-8',
              'cache-control': 'public, max-age=60' // Cache crawler response for 1 minute
            }
          });
        }
      } catch (err) {
        console.error('Error in worker crawler bypass:', err);
      }
    }
  }
  
  // 2. Normal user request: rewrite hostname to main domain so Firebase Hosting can serve it
  const originUrl = new URL(request.url);
  originUrl.hostname = "fahmni.me";
  return fetch(originUrl, request);
}
