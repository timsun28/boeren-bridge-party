import type { NextConfig } from "next";

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

const deriveProtocol = (host: string, explicitProtocol?: string | null) => {
    if (explicitProtocol === "http" || explicitProtocol === "https") {
        return explicitProtocol;
    }

    return host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
};

const partyKitHost = normalizeHost(process.env.NEXT_PUBLIC_PARTYKIT_HOST);
const partyKitProtocol = deriveProtocol(
    partyKitHost,
    process.env.NEXT_PUBLIC_PARTYKIT_PROTOCOL?.toLowerCase() ?? null
);
const partyKitOrigin = `${partyKitProtocol}://${partyKitHost}`;

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: "/party/:path*",
                destination: `${partyKitOrigin}/party/:path*`,
            },
            {
                source: "/parties/:party/:path*",
                destination: `${partyKitOrigin}/parties/:party/:path*`,
            },
        ];
    },
};

export default nextConfig;
