const normalizeHost = (rawHost?: string) => {
    if (!rawHost) {
        return "127.0.0.1:1999";
    }

    const trimmed = rawHost.trim();
    if (!trimmed) {
        return "127.0.0.1:1999";
    }

    return trimmed.replace(/^https?:\/\//, "");
};

const deriveProtocol = (host: string, explicitProtocol?: string) => {
    if (explicitProtocol === "http" || explicitProtocol === "https") {
        return explicitProtocol;
    }

    return host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
};

export const PARTYKIT_HOST = normalizeHost(process.env.NEXT_PUBLIC_PARTYKIT_HOST);

export const PARTYKIT_PROTOCOL = deriveProtocol(
    PARTYKIT_HOST,
    process.env.NEXT_PUBLIC_PARTYKIT_PROTOCOL?.toLowerCase()
);

export const PARTYKIT_URL = `${PARTYKIT_PROTOCOL}://${PARTYKIT_HOST}`;
