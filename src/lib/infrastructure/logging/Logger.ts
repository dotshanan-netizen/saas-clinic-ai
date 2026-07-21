/* eslint-disable @typescript-eslint/no-explicit-any */
export class Logger {
  private static maskPhone(phone: string): string {
    if (!phone) return phone;
    const clean = phone.trim();
    if (clean.length >= 9) {
      return clean.substring(0, 5) + "*****" + clean.substring(clean.length - 2);
    }
    return "***";
  }

  private static maskName(name: string): string {
    if (!name) return name;
    const clean = name.trim();
    const parts = clean.split(/\s+/);
    return parts
      .map((p) => {
        if (p.length <= 1) return p;
        return p[0] + "**" + (p.length > 2 ? p[p.length - 1] : "");
      })
      .join(" ");
  }

  private static maskText(text: string): string {
    if (!text) return text;
    const clean = text.trim();
    // Truncate message text to avoid logging full conversations or medical details
    if (clean.length > 15) {
      return clean.substring(0, 10) + "...[MASKED]";
    }
    return clean;
  }

  private static sanitizePayload(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => Logger.sanitizePayload(item));
    }

    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];

      // Match sensitive keys
      const lowercaseKey = key.toLowerCase();
      if (lowercaseKey.includes("phone")) {
        sanitized[key] = typeof val === "string" ? Logger.maskPhone(val) : val;
      } else if (lowercaseKey.includes("name") || lowercaseKey.includes("clientname")) {
        sanitized[key] = typeof val === "string" ? Logger.maskName(val) : val;
      } else if (
        lowercaseKey === "message" ||
        lowercaseKey === "content" ||
        lowercaseKey === "response" ||
        lowercaseKey === "finalresponse" ||
        lowercaseKey === "usermessage"
      ) {
        sanitized[key] = typeof val === "string" ? Logger.maskText(val) : val;
      } else if (typeof val === "object") {
        sanitized[key] = Logger.sanitizePayload(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }

  static info(message: string, context: { requestId: string; clinicId: string; [key: string]: any }) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      message: Logger.maskText(message),
      ...Logger.sanitizePayload(context),
    };
    console.log(JSON.stringify(payload));
  }

  static error(message: string, error: any, context: { requestId: string; clinicId: string; [key: string]: any }) {
    const errObj = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };

    const payload = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message: Logger.maskText(message),
      error: errObj,
      ...Logger.sanitizePayload(context),
    };
    console.error(JSON.stringify(payload));
  }

  static metric(name: string, value: number, context: { requestId: string; clinicId: string; [key: string]: any }) {
    const payload = {
      timestamp: new Date().toISOString(),
      level: "METRIC",
      metricName: name,
      metricValue: value,
      ...Logger.sanitizePayload(context),
    };
    console.log(JSON.stringify(payload));
  }
}
