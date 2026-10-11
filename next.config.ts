import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// Temporary escape hatch while you fix existing type/lint errors:
//   ALLOW_BUILD_ERRORS=1 npm run build
// Don't set it in production or CI.
const allowBuildErrors = process.env.ALLOW_BUILD_ERRORS === '1';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Camera and microphone are used by your own pages only.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(), payment=()',
  },
  // Production only: framing headers would break the Firebase Studio preview.
  ...(isProd
    ? [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: allowBuildErrors,
  },
  eslint: {
    ignoreDuringBuilds: allowBuildErrors,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },

  experimental: {
    serverActions: {
      // Camera/upload images are downscaled to ~1600px (well under 1 MB) and
      // the vision flow rejects anything above 4 MB anyway.
      bodySizeLimit: '4mb',
    },
  },

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'self-employed-u4g',
  project: 'javascript-nextjs',

  // Only print source-map upload logs in CI.
  silent: !process.env.CI,

  // Don't send build telemetry to Sentry.
  telemetry: false,

  // Upload a larger set of source maps for readable stack traces (longer builds).
  widenClientFileUpload: true,

  // Not using a tunnel route: it routes browser traffic through your server
  // and would add load and hosting cost.

  webpack: {
    treeshake: {
      // Removes Sentry's debug logger statements from the bundle.
      removeDebugLogging: true,
    },
  },
});