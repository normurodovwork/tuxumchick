import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});

export const metadata = {
  title: "EggLogistics B2B",
  description: "Egg Logistics B2B - Сводный обзор компании",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${inter.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="font-sans antialiased bg-slate-50 text-slate-900 h-screen w-full overflow-hidden m-0 p-0">
        {children}
      </body>
    </html>
  );
}
