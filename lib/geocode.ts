import "server-only";
import { normalisePostcode } from "@/lib/format";

export type Coordinates = { latitude: number; longitude: number };

type PostcodesIoResponse = {
  status: number;
  result?: { latitude: number; longitude: number; postcode: string } | null;
};

/**
 * UK postcode → coordinates, via postcodes.io (free, no key, ONS data).
 *
 * search_locums filters on latitude/longitude, so a practice or locum saved
 * without coordinates is invisible to search. Callers should treat null as a
 * validation failure rather than saving the row anyway.
 */
export async function geocodePostcode(postcode: string): Promise<Coordinates | null> {
  const clean = normalisePostcode(postcode);
  if (!clean) return null;

  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`,
      { next: { revalidate: 60 * 60 * 24 * 30 } }, // postcodes move rarely
    );
    if (!res.ok) return null;

    const body = (await res.json()) as PostcodesIoResponse;
    if (body.status !== 200 || !body.result) return null;

    return { latitude: body.result.latitude, longitude: body.result.longitude };
  } catch {
    return null;
  }
}
