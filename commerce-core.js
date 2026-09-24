(() => {
  'use strict';

  const cartKey = 'kisaragi-shop-demo-cart-v1';
  const maxQuantity = 99;

  const modules = Object.freeze([
    Object.freeze({id:'catalog', name:'商品カタログ', status:'READY_LOCAL', statusLabel:'表示中', description:'検索・分類・資料確認を利用できます。'}),
    Object.freeze({id:'cart', name:'ショッピングカート', status:'READY_LOCAL', statusLabel:'端末内で利用可', description:'未ログイン時は端末内、ログイン後は保護された会員カートで数量を管理します。'}),
    Object.freeze({id:'member', name:'会員ログイン', status:'BUILT_INACTIVE', statusLabel:'内部実装済み', description:'会員データ、認証、セッション、注文履歴の内部モジュールを実装済みです。外部公開時に保護APIを有効化します。'}),
    Object.freeze({id:'age', name:'年齢・本人確認', status:'BUILT_INACTIVE', statusLabel:'接続待ち', description:'注文単位のeKYC開始・状態照会・照合記録を実装済みです。契約事業者の認証情報は未設定です。'}),
    Object.freeze({id:'inventory', name:'在庫・販売価格', status:'BUILT_INACTIVE', statusLabel:'内部実装済み', description:'在庫台帳、引当、解除、確定減算と販売価格台帳を実装済みです。公開APIは未有効化です。'}),
    Object.freeze({id:'payment', name:'決済', status:'BUILT_INACTIVE', statusLabel:'接続待ち', description:'決済作成・状態照会・取消・返金・署名Webhookを実装済みです。契約事業者の認証情報は未設定です。'}),
    Object.freeze({id:'order', name:'注文管理', status:'BUILT_INACTIVE', statusLabel:'内部実装済み', description:'注文台帳、状態遷移、冪等処理、照合処理を実装済みです。注文受付スイッチは未有効化です。'}),
    Object.freeze({id:'logistics', name:'配送・追跡', status:'BUILT_INACTIVE', statusLabel:'接続待ち', description:'配送作成・追跡・対面受取条件の内部モジュールを実装済みです。契約運送事業者の認証情報は未設定です。'}),
    Object.freeze({id:'notification', name:'メール・領収書', status:'BUILT_INACTIVE', statusLabel:'接続待ち', description:'通知キュー、再送、配信結果記録を実装済みです。メール事業者の認証情報は未設定です。'})
  ]);

  const stages = Object.freeze([
    Object.freeze({id:'cart', label:'カート', status:'READY_LOCAL'}),
    Object.freeze({id:'identity', label:'会員・年齢確認', status:'BUILT_INACTIVE'}),
    Object.freeze({id:'delivery', label:'配送', status:'BUILT_INACTIVE'}),
    Object.freeze({id:'payment', label:'決済', status:'BUILT_INACTIVE'}),
    Object.freeze({id:'order', label:'注文確定', status:'BUILT_INACTIVE'})
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
