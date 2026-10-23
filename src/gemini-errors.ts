export function geminiFailure(status: number, body: any, retryAfter: string | null, key: string, attempt: number) {
  const clean = (value: unknown) => {
    const text = String(value ?? '');
    return (key ? text.split(key).join('[REDACTED]') : text).replace(/AIza[\w-]+/g, '[REDACTED]').slice(0, 2000);
  };
  const error = body?.error;
  const details: any[] = Array.isArray(error?.details) ? error.details : [];
  const violations = details.flatMap(detail => Array.isArray(detail.violations) ? detail.violations : []);
  const dailyOrZero = violations.some(item => /perday/i.test(String(item.quotaId)) || String(item.quotaValue) === '0');
  const delays = details.map(detail => String(detail.retryDelay ?? '').match(/^(\d+(?:\.\d+)?)s$/)).filter(Boolean).map(match => Number(match![1]) * 1000);
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay)) delays.push(Math.max(0, delay));
  }
  const requestedDelay = delays.length ? Math.max(...delays) : undefined;
  const delay = Math.max(1000 * 2 ** attempt, requestedDelay ?? 0);
  const retry = (status === 429 || status >= 500) && attempt < 2 && !dailyOrZero && delay <= 60000;
  const quota = violations.map(item => `${clean(item.quotaId || item.quotaMetric)}${item.quotaValue !== undefined ? ` (limit ${clean(item.quotaValue)})` : ''}`).join('; ');
  const message = [
    `Gemini request failed (HTTP ${status}${error?.status ? ` / ${clean(error.status)}` : ''}).`,
    clean(error?.message || 'No detailed error was returned.'),
    quota ? `Quota: ${quota}` : '',
    requestedDelay !== undefined ? `Google retry delay: ${Math.ceil(requestedDelay / 1000)} seconds.` : '',
    dailyOrZero ? 'Daily or zero quota reported; automatic retries stopped. Check the project limits in Google AI Studio.' : '',
    delay > 60000 ? 'Retry delay exceeds the automatic wait limit; retry later.' : '',
  ].filter(Boolean).join('\n');
  return { retry, delay, message };
}
