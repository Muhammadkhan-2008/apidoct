export function QRCode({ text, size = 180 }: { text: string; size?: number }) {
  const encoded = encodeURIComponent(text)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=0b0f19&color=6366f1`

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-950/80 border border-white/10 shadow-xl">
      <img
        src={qrUrl}
        alt={`QR Code for ${text}`}
        width={size}
        height={size}
        className="rounded-xl shadow-lg border border-indigo-500/20"
        loading="lazy"
        onError={(e) => {
          // If offline, show a styled fallback box with the link
          const parent = (e.target as HTMLElement).parentElement
          if (parent) {
            parent.innerHTML = `<div class="p-4 text-center font-mono text-xs text-indigo-400 break-all select-all">${text}</div>`
          }
        }}
      />
      <span className="text-[10px] text-muted-foreground mt-2 font-mono flex items-center gap-1">
        Scan with phone camera or open on PC
      </span>
    </div>
  )
}
