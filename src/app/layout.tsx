import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Truco Venezolano',
  description: 'Juega al Truco Venezolano online con amigos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#0f1a12] text-[#f0f4f0] antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
