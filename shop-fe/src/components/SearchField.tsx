// src/components/SearchField.tsx
'use client';

import { useRef, useState } from 'react';
import { Search, ImageUp, X } from 'lucide-react';

const SUGGESTIONS = [
  'áo sơ mi trắng đi tiệc',
  'quần ống rộng mặc đi làm',
  'đồ linen mùa nóng',
];

interface Props {
  onSearchText: (q: string) => void;
  onSearchImage: (file: File) => void;
  busy?: boolean;
}

export default function SearchField({ onSearchText, onSearchImage, busy }: Props) {
  const [value, setValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit() {
    const q = value.trim();
    if (q) onSearchText(q);
  }

  function takeFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setFileName(file.name);
    onSearchImage(file);
  }

  return (
    <section
      className={`finder${dragging ? ' dropzone-on' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        takeFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="wrap">
        <h1 className="finder__lead">Tả món bạn cần, hoặc thả vào một tấm ảnh.</h1>

        <div className="finder__field">
          <Search size={20} strokeWidth={1.5} aria-hidden />
          <input
            className="finder__input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="áo khoác nhẹ mặc mùa mưa"
            aria-label="Tìm sản phẩm"
            disabled={busy}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Tìm bằng ảnh"
            disabled={busy}
          >
            <ImageUp size={20} strokeWidth={1.5} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => takeFile(e.target.files?.[0])}
          />
        </div>
        <div className="ruler" aria-hidden />

        {fileName ? (
          <p className="finder__hint">
            Đang tìm theo ảnh <strong>{fileName}</strong>{' '}
            <button
              type="button"
              className="icon-btn"
              style={{ width: 24, height: 24, verticalAlign: 'middle' }}
              onClick={() => { setFileName(null); fileRef.current!.value = ''; }}
              aria-label="Bỏ ảnh"
            >
              <X size={14} />
            </button>
          </p>
        ) : (
          <div className="chip-row">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                onClick={() => { setValue(s); onSearchText(s); }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
