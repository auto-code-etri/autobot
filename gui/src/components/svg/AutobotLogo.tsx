interface AutobotLogoProps {
  height?: number;
  width?: number;
  className?: string;
}

export default function AutobotLogo({
  height = 75,
  width = 200,
  className = "",
}: AutobotLogoProps) {
  return (
    <img
      src="/logos/etri-logo.png"
      alt="ETRI"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
