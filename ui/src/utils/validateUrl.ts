export type ValidateUrlOptions = {
    allowedProtocols?: ("http:" | "https:")[]; // default: ["https:"]
    allowedHosts?: string[];
    allowLocalhost?: boolean;                  // default: false
    allowQuery?: boolean;                      // default: true
    allowHash?: boolean;                       // default: false
    maxLength?: number;                        // default: 2048
};

export type ValidateUrlResult = {
    isValid: boolean;
    normalized?: string;
    reason?: string;
};

const DEFAULTS: Required<ValidateUrlOptions> = {
    allowedProtocols: ["https:"],
    allowedHosts: [],
    allowLocalhost: false,
    allowQuery: true,
    allowHash: false,
    maxLength: 2048,
};

function normalizeInput(input: string) {
    const trimmed = input.trim();
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
}

export function validateUrl(
    input: string,
    options?: ValidateUrlOptions
): ValidateUrlResult {
    const opts = { ...DEFAULTS, ...options };
    if (!input || typeof input !== "string") return { isValid: false, reason: "Empty input" };

    const trimmed = input.trim();
    if (trimmed.length > opts.maxLength) return { isValid: false, reason: "URL too long" };

    let url: URL;

    try {
        const prepared = normalizeInput(trimmed);
        url = new URL(prepared);
    } catch {
        return { isValid: false, reason: "Invalid URL format" };
    }

    if (!opts.allowedProtocols.includes(url.protocol as any)) return { isValid: false, reason: "Protocol not allowed" };

    const hostname = url.hostname.toLowerCase();

    const isLocal =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";

    if (!opts.allowLocalhost && isLocal) return { isValid: false, reason: "Localhost not allowed" };

    if (opts.allowedHosts.length > 0) {
        const isAllowed = opts.allowedHosts.some((allowed) =>
            hostname === allowed || hostname.endsWith(`.${allowed}`)
        );

        if (!isAllowed) {
            return { isValid: false, reason: "Host not allowed" };
        }
    }

    if (!opts.allowQuery && url.search) return { isValid: false, reason: "Query params not allowed" };
    if (!opts.allowHash && url.hash) return { isValid: false, reason: "Hash not allowed" };

    return {
        isValid: true,
        normalized: url.toString(),
    };
}