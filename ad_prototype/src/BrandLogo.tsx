export default function BrandLogo({ stacked = false }: { stacked?: boolean }) {
  return (
    <span className="studio-wordmark">
      <img
        className={"studio-brand-logo" + (stacked ? " is-stacked" : "")}
        src={
          stacked
            ? "/assets/branding/selected/primary-stacked.svg"
            : "/assets/branding/selected/horizontal.svg"
        }
        alt="홍보잇다"
        width={stacked ? 480 : 700}
        height={stacked ? 380 : 180}
      />
      <span className="studio-brand-note">우리 가게의 작은 작업실</span>
    </span>
  )
}
