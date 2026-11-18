import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoTubeTV",
  description: "Odkrywaj kanały i publikuj własne filmy na GoTubeTV."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>{children}</body></html>;
}
