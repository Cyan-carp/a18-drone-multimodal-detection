import { useEffect, useMemo, useRef, useState } from 'react'
import { Clipboard, ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Modality = 'rgb' | 'ir'

interface UploadPanelProps {
  rgb: File | null
  ir: File | null
  onSelect: (modality: Modality, file: File | null) => void
  disabled?: boolean
}

function usePreview(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])
  return url
}

function DropZone({
  label,
  hint,
  file,
  preview,
  onPick,
  disabled,
}: {
  label: string
  hint: string
  file: File | null
  preview: string | null
  onPick: (file: File | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (disabled) return
        const next = event.dataTransfer.files?.[0]
        if (next) onPick(next)
      }}
      className={cn(
        'overflow-hidden rounded-control border border-dashed p-2 transition-colors',
        dragging ? 'border-signal-cyan bg-signal-cyan/10' : 'border-ink-600 bg-ink-800/50',
        disabled && 'opacity-60',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="space-y-1.5">
          <img src={preview} alt={label} className="h-[104px] w-full rounded-[7px] object-cover" />
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[11.5px] text-text-secondary">{file?.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={disabled}
              onClick={() => onPick(null)}
              aria-label={`清除${label}`}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex h-[124px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 text-text-muted transition-colors hover:text-signal-cyan disabled:cursor-not-allowed"
        >
          <ImagePlus size={20} strokeWidth={1.7} />
          <span className="text-[12.5px] text-text-primary">{label}</span>
          <span className="text-[11px]">{hint}</span>
        </button>
      )}
    </div>
  )
}

export function UploadPanel({ rgb, ir, onSelect, disabled }: UploadPanelProps) {
  const rgbPreview = usePreview(rgb)
  const irPreview = usePreview(ir)

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled) return
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith('image/'),
      )
      if (!item) return
      const file = item.getAsFile()
      if (!file) return
      onSelect(rgb ? 'ir' : 'rgb', file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [disabled, onSelect, rgb])

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <DropZone
          label="可见光 RGB"
          hint="PNG / JPG"
          file={rgb}
          preview={rgbPreview}
          onPick={(file) => onSelect('rgb', file)}
          disabled={disabled}
        />
        <DropZone
          label="红外 IR（可选）"
          hint="与 RGB 配准"
          file={ir}
          preview={irPreview}
          onPick={(file) => onSelect('ir', file)}
          disabled={disabled}
        />
      </div>
      <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-text-muted">
        <Clipboard size={13} className="mt-0.5 shrink-0" />
        <span>支持拖拽与 Ctrl+V 粘贴；仅上传 RGB 时双流分支会退化为单模态推理。</span>
      </p>
      {rgb || ir ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onSelect('rgb', null)
            onSelect('ir', null)
          }}
          className="w-full"
        >
          <Trash2 size={13} />
          清空本地图像
        </Button>
      ) : null}
    </div>
  )
}
