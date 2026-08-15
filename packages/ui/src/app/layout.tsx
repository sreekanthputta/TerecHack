import type { ReactNode } from "react";

export const metadata = {
  title: "AutoBusiness",
  description: "Zero-human company builder",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
