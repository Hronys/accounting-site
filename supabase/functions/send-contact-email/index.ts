const allowedOrigins = new Set([
  ...(Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'http://localhost:5173',
]);

function jsonResponse(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? '';
  if (!origin || !allowedOrigins.has(origin)) {
    return new Response('Origin is not allowed', { status: 403 });
  }
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
      },
    });
  }
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, origin);

  const apiKey = Deno.env.get('BREVO_API_KEY');
  const from = Deno.env.get('CONTACT_FROM_EMAIL') ?? 'nikolayivanovhome@gmail.com';
  if (!apiKey) {
    console.error('Missing BREVO_API_KEY function secret.');
    return jsonResponse({ error: 'Email is not configured' }, 503, origin);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request' }, 400, origin);
  }

  // Silently accept bot submissions that fill the hidden honeypot field.
  if (typeof input.website === 'string' && input.website.trim()) {
    return jsonResponse({ ok: true }, 200, origin);
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const service = typeof input.service === 'string' ? input.service.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
      || !service || service.length > 120 || message.length > 4000) {
    return jsonResponse({ error: 'Please check the form fields' }, 400, origin);
  }

  const senderName = Deno.env.get('CONTACT_FROM_NAME') ?? '\u0411\u0430\u043b\u0430\u043d\u0441';
  const messageContent = message || '(\u043d\u044f\u043c\u0430 \u0434\u043e\u043f\u044a\u043b\u043d\u0438\u0442\u0435\u043b\u043d\u043e \u0441\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435)';
  const labels = {
    name: '\u0418\u043c\u0435',
    email: '\u0418\u043c\u0435\u0439\u043b',
    service: '\u0423\u0441\u043b\u0443\u0433\u0430',
    message: '\u0421\u044a\u043e\u0431\u0449\u0435\u043d\u0438\u0435',
    subject: '\u041d\u043e\u0432\u043e \u0437\u0430\u043f\u0438\u0442\u0432\u0430\u043d\u0435 \u043e\u0442 \u0441\u0430\u0439\u0442\u0430',
  };
  const textContent = `${labels.name}: ${name}\n${labels.email}: ${email}\n${labels.service}: ${service}\n\n${labels.message}:\n${messageContent}`;
  const htmlContent = `<h2>${labels.subject}</h2><p><strong>${labels.name}:</strong> ${escapeHtml(name)}</p><p><strong>${labels.email}:</strong> ${escapeHtml(email)}</p><p><strong>${labels.service}:</strong> ${escapeHtml(service)}</p><p><strong>${labels.message}:</strong><br>${escapeHtml(messageContent).replace(/\n/g, '<br>')}</p>`;

  let brevoResponse: Response;
  try {
    brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: from, name: senderName },
        to: [{ email: 'nikolayivanovhome@gmail.com' }],
        replyTo: { email },
        subject: `${labels.subject}: ${name}`,
        textContent,
        htmlContent,
      }),
    });
  } catch (error) {
    console.error('Could not reach Brevo:', error);
    return jsonResponse({ error: 'Email could not be sent' }, 502, origin);
  }

  if (!brevoResponse.ok) {
    console.error('Brevo rejected contact email:', brevoResponse.status, await brevoResponse.text());
    return jsonResponse({ error: 'Email could not be sent' }, 502, origin);
  }
  return jsonResponse({ ok: true }, 200, origin);
});
