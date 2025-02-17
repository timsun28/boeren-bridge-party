/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        const PARTYKIT_URL = process.env.NEXT_PUBLIC_PARTYKIT_HOST
            ? `https://${process.env.NEXT_PUBLIC_PARTYKIT_HOST}`
            : "http://127.0.0.1:1999";

        return [
            {
                source: "/party/:path*",
                destination: `${PARTYKIT_URL}/party/:path*`,
            },
            {
                source: "/parties/:party/:path*",
                destination: `${PARTYKIT_URL}/parties/:party/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
