(() => {
  'use strict';

  const cartKey = 'kisaragi-shop-demo-cart-v1';
  const maxQuantity = 99;

  const modules = Object.freeze([
    Object.freeze({id:'catalog', name:'商品カタログ', status:'READY_LOCAL', statusLabel:'表示中', description:'検索・分類・資料確認を利用できます。'}),
    Object.freeze({id:'cart', name:'ショッピングカート', status:'READY_LOCAL', statusLabel:'端末内で利用可', description:'数量変更・削除・概算小計を端末内だけで保持します。'}),
    Object.freeze({id:'member', name:'会員ログイン', status:'NOT_CONNECTED', statusLabel:'未接続', description:'会員登録、ログイン、購入履歴はまだ接続していません。'}),
    Object.freeze({id:'age', name:'年齢・本人確認', status:'NOT_CONNECTED', statusLabel:'未接続', description:'公的証明書を使うeKYCはまだ接続していません。'}),
    Object.freeze({id:'inventory', name:'在庫・販売価格', status:'NOT_CONNECTED', statusLabel:'未接続', description:'在庫引当、販売可否、正式価格の確定はまだ行いません。'}),
    Object.freeze({id:'payment', name:'決済', status:'NOT_CONNECTED', statusLabel:'未接続', description:'カード番号等は収集せず、決済も開始しません。'}),
    Object.freeze({id:'order', name:'注文管理', status:'NOT_CONNECTED', statusLabel:'未接続', description:'注文番号、受注データ、管理画面への登録は発生しません。'}),
    Object.freeze({id:'logistics', name:'配送・追跡', status:'PREVIEW_ONLY', statusLabel:'試算のみ', description:'配送方法と送料の画面試算のみ利用できます。'}),
    Object.freeze({id:'notification', name:'メール・領収書', status:'NOT_CONNECTED', statusLabel:'未接続', description:'確認メール、領収書、発送通知は送信しません。'})
  ]);

  const stages = Object.freeze([
    Object.freeze({id:'cart', label:'カート', status:'READY_LOCAL'}),
    Object.freeze({id:'identity', label:'会員・年齢確認', status:'NOT_CONNECTED'}),
    Object.freeze({id:'delivery', label:'配送', status:'PREVIEW_ONLY'}),
    Object.freeze({id:'payment', label:'決済', status:'NOT_CONNECTED'}),
    Object.freeze({id:'order', label:'注文確定', status:'NOT_CONNECTED'})
  ]);

  function normalizeCart(raw) {
    if (!Array.isArray(raw)) return [];
    const merged = new Map();
    raw.forEach((entry) => {
      const id = typeof entry === 'string' ? entry : entry?.id;
      if (!id || typeof id !== 'string') return;
      const requestedQuantity = typeof entry === 'string' ? 1 : Number(entry.quantity ?? entry.qty ?? 1);
      const quantity = Math.min(maxQuantity, Math.max(1, Number.isFinite(requestedQuantity) ? Math.floor(requestedQuantity) : 1));
      const previous = merged.get(id) || 0;
      merged.set(id, Math.min(maxQuantity, previous + quantity));
    });
    return [...merged].map(([id, quantity]) => ({id, quantity}));
  }

  function parseCart(serialized) {
    try {
      return normalizeCart(JSON.parse(serialized || '[]'));
    } catch {
      return [];
    }
  }

  function readCart(storage = globalThis.localStorage) {
    if (!storage?.getItem) return [];
    return parseCart(storage.getItem(cartKey));
  }

  function writeCart(lines, storage = globalThis.localStorage) {
    const normalized = normalizeCart(lines);
    if (storage?.setItem) storage.setItem(cartKey, JSON.stringify(normalized));
    return normalized;
  }

  const quantityCount = (lines) => normalizeCart(lines).reduce((sum, line) => sum + line.quantity, 0);
  const moduleFor = (id) => modules.find((module) => module.id === id) || null;

  globalThis.KISARAGI_COMMERCE = Object.freeze({
    cartKey,
    maxQuantity,
    modules,
    stages,
    normalizeCart,
    parseCart,
    readCart,
    writeCart,
    quantityCount,
    moduleFor
  });
})();
