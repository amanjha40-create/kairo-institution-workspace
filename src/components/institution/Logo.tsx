import logo from "@/assets/kairo-logo.png";

export function KairoLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="KairoID"
      width={2019}
      height={492}
      className={`${className} object-contain`}
    />
  );
}
