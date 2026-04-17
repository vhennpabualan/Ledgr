import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';

export interface ScanResult {
  amount: number | null;       // minor units (centavos), null if not found
  date: string | null;         // ISO date string YYYY-MM-DD, null if not found
  description: string | null;  // merchant / item name, null if not found
  currency: string | null;     // ISO 4217 code e.g. "PHP", null if not found
  confidence: 'high' | 'low';  // high = all key fields found, low = partial
}

const PROMPT = `You are a receipt parser. Analyze this receipt image and extract:
1. Total amount paid (the final total, not subtotals)
2. Date of transaction
3. Merchant name or brief description (max 60 chars)
4. Currency code (e.g. PHP, USD)

Respond ONLY with a valid JSON object in this exact shape, no markdown, no explanation:
{
  "amount": <number in major units e.g. 123.45, or null if not visible>,
  "date": <"YYYY-MM-DD" string, or null if not visible>,
  "description": <"string" merchant/item, or null if not visible>,
  "currency": <"PHP" or other ISO code, or null if not visible>
}

If the image is not a receipt, return all null values.`;

/**
 * Scan a receipt image buffer and extract expense data.
 * Returns null if GEMINI_API_KEY is not configured.
 */
export async function scanReceipt(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ScanResult | null> {
  if (!env.GEMINI_API_KEY) return null;

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    PROMPT,
    {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType,
      },
    },
  ]);

  const text = result.response.text().trim();

  // Strip markdown code fences if Gemini wraps the JSON anyway
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: { amount: number | null; date: string | null; description: string | null; currency: string | null };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Gemini returned something unparseable — treat as low-confidence empty result
    return { amount: null, date: null, description: null, currency: null, confidence: 'low' };
  }

  // Convert major units → minor units (centavos)
  const amountMinor = parsed.amount != null && !isNaN(parsed.amount)
    ? Math.round(parsed.amount * 100)
    : null;

  // Validate date format
  const dateValid = parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date);

  const confidence: 'high' | 'low' =
    amountMinor != null && dateValid ? 'high' : 'low';

  return {
    amount: amountMinor,
    date: dateValid ? parsed.date : null,
    description: parsed.description ?? null,
    currency: parsed.currency ?? null,
    confidence,
  };
}
