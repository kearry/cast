/** @type {import('next').NextConfig} */

const nextConfig = {
    experimental: {

        serverComponentsExternalPackages: ["spacy-wasm"] // this line is important!!!
    },
    reactStrictMode: true,
}
export default nextConfig;