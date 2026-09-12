import logo from "@/assets/kairoid-logo-primary.png";

export function KairoLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src={logo} alt="KairoID" className={className} />;
}
