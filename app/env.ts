export const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";

export const PARTYKIT_PROTOCOL =
    PARTYKIT_HOST?.startsWith("localhost") || PARTYKIT_HOST?.startsWith("127.0.0.1") ? "http" : "https";

export const PARTYKIT_URL = `${process.env.NEXT_PUBLIC_PARTYKIT_PROTOCOL ?? "http"}://${PARTYKIT_HOST}`;
