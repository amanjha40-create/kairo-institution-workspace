import logo from "@/assets/kairo-logo.png";

export function KairoLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src={logo} alt="Kairo" className={className} />;
}
