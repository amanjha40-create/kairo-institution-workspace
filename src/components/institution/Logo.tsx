import logo from "@/assets/kairo-logo.png.asset.json";

export function KairoLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src={logo.url} alt="Kairo" className={className} />;
}
