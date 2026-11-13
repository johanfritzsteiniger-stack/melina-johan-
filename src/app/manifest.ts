import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Melina & Johan",
    short_name: "M & J",
    description: "Unsere gemeinsame App",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#0d9488",
    lang: "de",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
