export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="animate-in fade-in zoom-in-95 duration-300">{children}</div>
    </div>
  );
}
