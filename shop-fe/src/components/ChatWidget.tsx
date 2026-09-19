// src/components/ChatWidget.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Paperclip, ImagePlus, Plus } from 'lucide-react';
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

const MAX_TRAY = 9;

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
  const [tray, setTray] = useState<{ url: string }[]>([]);
  const [dropHot, setDropHot] = useState(false);
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

  /** Chon/dan/tha nhieu anh -> tai len ngay va xep vao "khay" xem truoc, CHUA gui — nhan vien xem lai,
   * bo bot anh sai roi bam "Gui" 1 lan (thay vi moi anh 1 tin nhan nhu truoc). */
  async function addToTray(files: File[]) {
    const list = files.filter((f) => f.type.startsWith('image/'));
    if (list.length === 0 || busy || uploadingImage) return;
    setUploadingImage(true);
    try {
      for (const file of list) {
        if (tray.length >= MAX_TRAY) break;
        const uploaded = await adminApi.uploadImage(file);
        setTray((prev) => (prev.length >= MAX_TRAY ? prev : [...prev, { url: uploaded.url }]));
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

  async function sendTray(andDone = false) {
    if (tray.length === 0 || busy) return;
    const urls = tray.map((t) => t.url);
    setTray([]);
    await send(urls.join('\n'), `📷 Đã gửi ${urls.length} ảnh`);
    if (andDone) await send('xong');
  }

  const lastMsg = messages[messages.length - 1];
  const expectingImage = lastMsg?.role === 'assistant' && !!lastMsg.expectingImage;

  return (
    <div className="chatw">
      {open && (
        <div
          className="chatw__panel" role="dialog" aria-label="Chat tư vấn"
          onDragOver={(e) => { if (expectingImage) { e.preventDefault(); setDropHot(true); } }}
          onDragLeave={() => setDropHot(false)}
          onDrop={(e) => {
            setDropHot(false);
            if (!expectingImage) return;
            e.preventDefault();
            addToTray(Array.from(e.dataTransfer.files));
          }}
        >
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

          <div className="chatw__foot">
            {expectingImage && (
              <div className={`chatw__tray${dropHot ? ' chatw__tray--hot' : ''}`}>
                {tray.length === 0 && !uploadingImage ? (
                  <button type="button" className="chatw__tray-empty" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    <ImagePlus size={16} strokeWidth={1.5} />
                    Chọn nhiều ảnh cùng lúc, hoặc kéo ảnh vào đây (dán Ctrl+V cũng được)
                  </button>
                ) : (
                  <>
                    <div className="chatw__thumbs">
                      {tray.map((t, i) => (
                        <div className="chatw__thumb" key={t.url}>
                          <img src={t.url} alt={`Ảnh ${i + 1}`} />
                          <button type="button" aria-label={`Bỏ ảnh ${i + 1}`} onClick={() => setTray((p) => p.filter((x) => x.url !== t.url))}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {uploadingImage && <div className="chatw__thumb chatw__thumb--loading">…</div>}
                      {tray.length < MAX_TRAY && !uploadingImage && (
                        <button type="button" className="chatw__thumb chatw__thumb--add" onClick={() => fileInputRef.current?.click()} aria-label="Thêm ảnh">
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                    <div className="chatw__tray-actions">
                      <span>{tray.length}/{MAX_TRAY} ảnh</span>
                      <button type="button" className="chatw__tray-send chatw__tray-send--ghost" onClick={() => sendTray(false)} disabled={busy || uploadingImage || tray.length === 0}>
                        Gửi ảnh
                      </button>
                      <button type="button" className="chatw__tray-send" onClick={() => sendTray(true)} disabled={busy || uploadingImage || tray.length === 0}>
                        Gửi {tray.length || ''} ảnh &amp; xong
                      </button>
                    </div>
                  </>
                )}
                {tray.length === 0 && !uploadingImage && (
                  <button type="button" className="chatw__done" onClick={() => send('xong')} disabled={busy}>
                    Xong, không thêm ảnh nữa
                  </button>
                )}
              </div>
            )}
            <div className="chatw__input">
              {expectingImage && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => addToTray(e.target.files ? Array.from(e.target.files) : [])}
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
                onPaste={(e) => {
                  const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
                  if (expectingImage && imgs.length > 0) { e.preventDefault(); addToTray(imgs); }
                }}
                placeholder={uploadingImage ? 'Đang tải ảnh lên…' : 'Nhắn cho trợ lý…'}
                disabled={busy || uploadingImage}
                aria-label="Nhập tin nhắn"
              />
              <button type="button" className="icon-btn" onClick={() => send()} disabled={busy || uploadingImage || !input.trim()} aria-label="Gửi">
                <Send size={18} strokeWidth={1.5} />
              </button>
            </div>
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
