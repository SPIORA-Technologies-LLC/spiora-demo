import type { MetadataRoute } from "next";
import { getManifestConfig } from "@/config/branding";

export default function manifest(): MetadataRoute.Manifest {
  return getManifestConfig();
}
