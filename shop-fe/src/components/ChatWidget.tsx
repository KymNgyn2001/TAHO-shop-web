// src/components/ChatWidget.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send } from 'lucide-react';
import { api, ApiException } from '@/lib/api-client';
import type { ProductCard, Order } from '@/lib/api-contract';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  products?: ProductCard[];
  order?: Order;
};

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const GREETING: Msg = {
  role: 'assistant',
  content: 'Chào bạn! Mình là trợ lý của TAHO. Bạn cần tìm món gì, hay muốn tra cứu/huỷ đơn hàng, cứ nhắn cho mình nhé.',
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    try {
      const reply = await api.chat({ message: text, history });
      setMessages((prev) => [...prev, reply]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: e instanceof ApiException ? e.message : 'Mình đang gặp trục trặc, bạn thử lại sau ít phút nhé.',
      }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chatw">
      {open && (
        <div className="chatw__panel" role="dialog" aria-label="Chat tư vấn">
          <div className="chatw__head">
            <span>Trợ lý TAHO</span>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Đóng chat">
              <X size={18} />
            </button>
          </div>

          <div className="chatw__body">
            {messages.map((m, i) => (
              <div key={i} className={`chatw__msg chatw__msg--${m.role}`}>
                <p>{m.content}</p>
                {m.products && m.products.length > 0 && (
                  <div className="chatw__products">
                    {m.products.map((p) => (
                      <Link key={p.id} href={`/products/${p.slug}`} className="chatw__product" onClick={() => setOpen(false)}>
                        {p.primaryImageUrl && <img src={p.primaryImageUrl} alt={p.name} />}
                        <span>{p.name}</span>
                        <strong>{vnd(p.basePrice)}</strong>
                      </Link>
                    ))}
                  </div>
                )}
                {m.order && (
                  <Link href={`/orders/${m.order.code}`} className="chatw__order" onClick={() => setOpen(false)}>
                    Đơn {m.order.code} — {m.order.status}
                  </Link>
                )}
              </div>
            ))}
            {busy && <div className="chatw__msg chatw__msg--assistant"><p>Đang gõ…</p></div>}
            <div ref={bottomRef} />
          </div>

          <div className="chatw__input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Nhắn cho trợ lý…"
              disabled={busy}
              aria-label="Nhập tin nhắn"
            />
            <button type="button" className="icon-btn" onClick={send} disabled={busy || !input.trim()} aria-label="Gửi">
              <Send size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="chatw__fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Đóng chat tư vấn' : 'Mở chat tư vấn'}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
