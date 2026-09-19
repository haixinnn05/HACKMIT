import type { MetadataRoute } from "next";

/** Lets the app be added to a phone's home screen and open standalone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mozaic",
    short_name: "Mozaic",
    description: "Understand what taking part in a cancer trial would involve.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafbfe",
    theme_color: "#3c27b5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
