// src/components/ChatWidget.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Paperclip } from 'lucide-react';
import { api, ApiException } from '@/lib/api-client';
import { adminApi } from '@/lib/admin-api';
import type { ProductCard, Order, ChatContext } from '@/lib/api-contract';
import { useCart } from '@/lib/cart-context';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  products?: ProductCard[];
  order?: Order;
  cartUpdated?: boolean;
  confirm?: boolean;
  expectingImage?: boolean;
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
  const [uploadingImage, setUploadingImage] = useState(false);
  // Dung ref (khong phai state) cho context — khi gui nhieu anh lien tiep (vong lap
  // await tuan tu trong attachImages), moi lan goi send() phai thay duoc context
  // MOI NHAT ngay lap tuc, khong doi kip 1 vong render nhu useState moi cap nhat kip.
  const contextRef = useRef<ChatContext>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refresh: refreshCart } = useCart();

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send(override?: string, displayText?: string) {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: displayText ?? text }]);
    if (!override) setInput('');
    setBusy(true);
    try {
      const reply = await api.chat({ message: text, history, context: contextRef.current });
      setMessages((prev) => [...prev, reply]);
      contextRef.current = reply.context ?? {};
      if (reply.cartUpdated) await refreshCart();
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: e instanceof ApiException ? e.message : 'Mình đang gặp trục trặc, bạn thử lại sau ít phút nhé.',
      }]);
    } finally {
      setBusy(false);
    }
  }

  async function attachImages(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0 || busy || uploadingImage) return;
    setUploadingImage(true);
    try {
      for (const file of list) {
        const uploaded = await adminApi.uploadImage(file);
        await send(uploaded.url, '📷 Đã gửi 1 ảnh');
      }
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: e instanceof ApiException ? e.message : 'Tải ảnh lên thất bại, bạn thử lại nhé.',
      }]);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const lastMsg = messages[messages.length - 1];
  const expectingImage = lastMsg?.role === 'assistant' && !!lastMsg.expectingImage;

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
                {m.cartUpdated && (
                  <Link href="/cart" className="chatw__order" onClick={() => setOpen(false)}>
                    Xem giỏ hàng →
                  </Link>
                )}
                {m.confirm && i === messages.length - 1 && (
                  <div className="chatw__confirm">
                    <button type="button" className="chatw__confirm-yes" disabled={busy} onClick={() => send('Đồng ý')}>
                      Đồng ý
                    </button>
                    <button type="button" className="chatw__confirm-no" disabled={busy} onClick={() => send('Không')}>
                      Không
                    </button>
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="chatw__msg chatw__msg--assistant"><p>Đang gõ…</p></div>}
            <div ref={bottomRef} />
          </div>

          <div className="chatw__input">
            {expectingImage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => attachImages(e.target.files)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy || uploadingImage}
                  aria-label="Đính kèm ảnh (chọn được nhiều ảnh)"
                  title="Đính kèm ảnh (chọn được nhiều ảnh)"
                >
                  <Paperclip size={18} strokeWidth={1.5} />
                </button>
              </>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={uploadingImage ? 'Đang tải ảnh lên…' : 'Nhắn cho trợ lý…'}
              disabled={busy || uploadingImage}
              aria-label="Nhập tin nhắn"
            />
            <button type="button" className="icon-btn" onClick={() => send()} disabled={busy || uploadingImage || !input.trim()} aria-label="Gửi">
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
