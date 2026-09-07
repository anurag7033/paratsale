import logo from "@/assets/parat-haben-logo.jpg.asset.json";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Parat Haben Systems"
      className={`h-9 w-auto rounded-md bg-white object-contain px-1 ${className}`}
    />
  );
}

export function BrandLockup({ subtitle = "Distribution Core" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className="h-10" />
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Parat Haben Systems</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
