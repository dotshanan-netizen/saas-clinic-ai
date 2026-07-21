export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  bookingData?: ExtractedBookingData | null;
  sessionReset?: boolean;
}

export interface ExtractedBookingData {
  clientName: string | null;
  clientPhone: string | null;
  serviceName: string | null;
  doctorName: string | null;
  branchName: string | null;
  timeSlot: string | null;
}

export interface ClinicWithCatalog {
  id: string;
  name: string;
  customPrompt: string | null;
  branches: { id: string; name: string }[];
  doctors: { 
    id: string; 
    name: string; 
    specialty: string;
    services?: { service: { name: string } }[];
  }[];
  services: { id: string; name: string; price: number }[];
}

// Helpers
export function extractSaudiPhone(text: string | null): string | null {
  if (!text) return null;
  const clean = text.replace(/[\s-]/g, "");
  const match = clean.match(/(?<!\d)(?:\+?966|0)?5\d{8}(?!\d)/);
  return match ? match[0] : null;
}

export function isValidSaudiPhone(phone: string): boolean {
  return extractSaudiPhone(phone) !== null;
}

export function normalizeToOfficial(
  extracted: string | null,
  officialList: string[]
): string | null {
  if (!extracted) return null;
  const clean = extracted.trim().toLowerCase();

  const exact = officialList.find((o) => o.toLowerCase() === clean);
  if (exact) return exact;

  const partial = officialList.find(
    (o) => o.toLowerCase().includes(clean) || clean.includes(o.toLowerCase())
  );
  if (partial) return partial;

  const words = clean.split(/\s+/);
  const scored = officialList
    .map((o) => {
      const oWords = o.toLowerCase().split(/\s+/);
      const overlap = words.filter((w) =>
        oWords.some((ow) => ow.includes(w) || w.includes(ow))
      ).length;
      return { name: o, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap);

  if ((scored[0]?.overlap || 0) > 0) return scored[0].name;

  return null;
}
