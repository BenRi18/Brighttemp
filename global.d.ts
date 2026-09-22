// Lets TypeScript accept side-effect style imports such as `import "./globals.css"`.
// Newer TypeScript versions check these by default; Next.js handles the CSS itself.
declare module "*.css";
