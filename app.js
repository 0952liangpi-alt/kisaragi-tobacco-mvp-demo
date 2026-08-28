const products = [
  {id:1,brand:'Kisaragi',brandKey:'kisaragi',name:'Kisaragi No. 01',sku:'KS-001',price:620,stock:24,meta:'20本 / レギュラー',tar:8,nicotine:0.6,size:'20本入',tone:''},
  {id:2,brand:'Haru Leaf',brandKey:'haru',name:'Haru Leaf Mild',sku:'HL-014',price:580,stock:12,meta:'20本 / レギュラー',tar:6,nicotine:0.5,size:'20本入',tone:'red'},
  {id:3,brand:'Nami',brandKey:'nami',name:'Nami Classic',sku:'NM-022',price:610,stock:0,meta:'20本 / レギュラー',tar:10,nicotine:0.8,size:'20本入',tone:'dark'},
  {id:4,brand:'Kisaragi',brandKey:'kisaragi',name:'Kisaragi Menthol',sku:'KS-008',price:620,stock:31,meta:'20本 / メンソール',tar:7,nicotine:0.6,size:'20本入',tone:'dark'},
  {id:5,brand:'Haru Leaf',brandKey:'haru',name:'Haru Leaf Gold',sku:'HL-020',price:650,stock:7,meta:'20本 / リッチ',tar:9,nicotine:0.7,size:'20本入',tone:''},
  {id:6,brand:'Nami',brandKey:'nami',name:'Nami Blue',sku:'NM-031',price:590,stock:0,meta:'20本 / ライト',tar:4,nicotine:0.3,size:'20本入',tone:'red'},
];

let cart = [];
let lastTrigger = null;
const CART_KEY = 'kisaragiDemoCart';
const AGE_VERIFIED_KEY = 'age_verified';
const $ = (selector) => document.querySelector(selector);
const yen = (value) => `¥${value.toLocaleString('ja-JP')}（税込）`;
const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
const ageModal = $('#ageGate');
const mainContent = $('#mainContent');
let releaseAgeFocus = null;

const legalContent = {
  tokusho: {
    title: '特定商取引法に基づく表記',
    body: `<p>本ページは機能検証用のデモサイトです。商品の実販売、決済、契約、配送は行っていません。</p>
      <dl class="legal-list"><div><dt>販売事業者</dt><dd>テストサイトのため未設定</dd></div><div><dt>販売価格</dt><dd>画面上の価格はデモ表示です</dd></div><div><dt>代金の支払時期・方法</dt><dd>決済機能は未接続です</dd></div><div><dt>引渡時期</dt><dd>配送・引渡しは行いません</dd></div><div><dt>返品・交換</dt><dd>デモのため対象外です</dd></div></dl><p>実運用前に、許可を持つ事業者の正確な事業者情報・販売条件・通信販売条件へ差し替えが必要です。</p>`
  },
  privacy: {
    title: 'プライバシーポリシー',
    body: `<p>本デモはサーバーへ個人情報を送信しません。お問い合わせ・購入審査フォームの入力内容は送信・保存されません。</p>
      <dl class="legal-list"><div><dt>取得する情報</dt><dd>デモ動作に必要な年齢確認状態とカート内容のみ、端末内に保存します</dd></div><div><dt>第三者提供</dt><dd>行いません</dd></div><div><dt>実運用時</dt><dd>本人確認・注文・配送を開始する前に、適法なプライバシーポリシーとデータ取扱体制を整備します</dd></div></dl>`
  }
};

function persistCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart.map(({product, qty}) => ({id: product.id, qty}))));
}

function restoreCart() {
  try {
    cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]').map(({id, qty}) => {
      const product = products.find((item) => item.id === id);
      return product?.stock > 0 ? {product, qty: Math.min(qty, product.stock)} : null;
    }).filter(Boolean);
  } catch {
    cart = [];
  }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function setModal(selector, open) {
  const modal = $(selector);
  modal.classList.toggle('open', open);
  document.body.classList.toggle('modal-open', open);
  if (open) window.setTimeout(() => modal.querySelector(focusable)?.focus(), 0);
  else lastTrigger?.focus?.();
}

function lockAgeModalFocus() {
  if (!ageModal || releaseAgeFocus) return;

  const background = [...document.body.children].filter((element) => element !== ageModal && element.tagName !== 'SCRIPT');
  background.forEach((element) => {
    element.dataset.ageGateAriaHidden = element.getAttribute('aria-hidden') || '';
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('inert', '');
  });
  document.body.style.overflow = 'hidden';
  mainContent?.setAttribute('aria-hidden', 'true');

  const getFocusable = () => [...ageModal.querySelectorAll(focusable)].filter((element) => !element.hidden);
  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const elements = getFocusable();
    if (!elements.length) return;
    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  ageModal.addEventListener('keydown', onKeydown);
  window.setTimeout(() => getFocusable()[0]?.focus(), 0);
  releaseAgeFocus = () => {
    ageModal.removeEventListener('keydown', onKeydown);
    background.forEach((element) => {
      const previous = element.dataset.ageGateAriaHidden;
      if (previous) element.setAttribute('aria-hidden', previous);
      else element.removeAttribute('aria-hidden');
      element.removeAttribute('inert');
      delete element.dataset.ageGateAriaHidden;
    });
    document.body.style.overflow = '';
    mainContent?.removeAttribute('aria-hidden');
    releaseAgeFocus = null;
  };
}

function unlockAgeModal() {
  releaseAgeFocus?.();
  localStorage.setItem(AGE_VERIFIED_KEY, 'true');
  ageModal?.setAttribute('aria-hidden', 'true');
  if (ageModal) ageModal.style.display = 'none';
}

function openLegalModal(type, trigger = document.activeElement) {
  const content = legalContent[type];
  if (!content) return;
  lastTrigger = trigger;
  $('#legalTitle').textContent = content.title;
  $('#legalBody').innerHTML = content.body;
  $('#legalModal').setAttribute('aria-hidden', 'false');
  setModal('#legalModal', true);
}

function closeLegalModal() {
  $('#legalModal').setAttribute('aria-hidden', 'true');
  setModal('#legalModal', false);
}

window.openLegalModal = openLegalModal;

function renderProducts() {
  const brand = $('#brandFilter').value;
  const stock = $('#stockFilter').value;
  const query = $('#searchInput').value.toLowerCase().trim();
  const list = products.filter((product) =>
    (brand === 'all' || product.brandKey === brand) &&
    (stock === 'all' || (stock === 'available' ? product.stock > 0 : product.stock === 0)) &&
    `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(query)
  );

  $('#resultCount').textContent = `${list.length} 件の商品`;
  $('#productGrid').innerHTML = list.length ? list.map((product) => `
    <article class="product-card">
      <button class="product-visual ${product.tone}" data-detail="${product.id}" aria-label="${product.name}の詳細を見る">
        ${product.stock === 0 ? '<span class="sold-label">SOLD OUT</span>' : ''}
        <div class="pack"><small>${product.brand.toUpperCase()}</small><strong>${product.name.split(' ')[0]}<br />${product.name.split(' ')[1] || ''}</strong><small>20 / JAPAN</small></div>
      </button>
      <div class="product-info">
        <p class="eyebrow">${product.sku}</p><h3>${product.name}</h3>
        <div class="product-meta"><span>${product.meta}</span><span>${product.stock ? `在庫 ${product.stock}` : '売り切れ'}</span></div>
        <div class="product-specs"><span>タール ${product.tar}mg</span><span>ニコチン ${product.nicotine}mg</span></div>
        <div class="product-bottom"><span class="price">${yen(product.price)}</span><button class="add-button" data-add="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>${product.stock ? 'カートに追加' : '再入荷待ち'}</button></div>
      </div>
    </article>`).join('') : '<p class="empty-cart">条件に一致する商品がありません。</p>';
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  $('#cartCount').textContent = count;
  $('#mobileCartCount').textContent = count;
  $('#cartItems').innerHTML = cart.length ? cart.map(({product, qty}) => `
    <div class="cart-row"><div><strong>${product.name}</strong><small>${qty}点 / ${yen(product.price * qty)}</small></div><button data-remove="${product.id}">削除</button></div>`).join('') :
    '<p class="empty-cart">カートは空です。<br />商品を選んで追加してください。</p>';
  $('#cartTotal').textContent = yen(cart.reduce((sum, item) => sum + item.product.price * item.qty, 0));
  persistCart();
}

function addToCart(product) {
  if (!product || product.stock === 0) return;
  const existing = cart.find((item) => item.product.id === product.id);
  if (existing?.qty >= product.stock) return showToast('在庫数を超えて追加できません');
  if (existing) existing.qty += 1;
  else cart.push({product, qty: 1});
  renderCart();
  showToast('カートに追加しました');
}

function openCart(trigger) {
  lastTrigger = trigger || document.activeElement;
  $('#cartDrawer').classList.add('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'false');
  $('#drawerBackdrop').classList.add('open');
  document.body.classList.add('modal-open');
  $('#cartDrawer').querySelector(focusable)?.focus();
}

function closeCart() {
  $('#cartDrawer').classList.remove('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'true');
  $('#drawerBackdrop').classList.remove('open');
  document.body.classList.remove('modal-open');
  lastTrigger?.focus?.();
}

function openProductDetail(product, trigger) {
  lastTrigger = trigger;
  $('#detailBody').innerHTML = `
    <p class="eyebrow">${product.sku} / ${product.brand}</p><h2>${product.name}</h2>
    <div class="detail-pack product-visual ${product.tone}"><div class="pack"><small>${product.brand.toUpperCase()}</small><strong>${product.name.split(' ')[0]}<br />${product.name.split(' ')[1] || ''}</strong><small>20 / JAPAN</small></div></div>
    <dl class="detail-specs"><div><dt>価格</dt><dd>${yen(product.price)}</dd></div><div><dt>規格</dt><dd>${product.size}</dd></div><div><dt>タール</dt><dd>${product.tar}mg</dd></div><div><dt>ニコチン</dt><dd>${product.nicotine}mg</dd></div><div><dt>在庫</dt><dd>${product.stock ? `${product.stock}点` : 'SOLD OUT'}</dd></div></dl>
    <p class="detail-note">本商品はデモ用の架空商品です。実運用では正規商品情報・批准価格・販売許可範囲を確認して掲載します。</p>
    <button class="button button-primary full" data-add="${product.id}" ${product.stock === 0 ? 'disabled' : ''}>${product.stock ? 'カートに追加' : '再入荷待ち'}</button>`;
  setModal('#detailModal', true);
}

function openReview() {
  if (!cart.length) return showToast('商品をカートに追加してください');
  lastTrigger = document.activeElement;
  const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  $('#reviewSummary').innerHTML = `<strong>申請内容（デモ）</strong><span>${quantity} 点 / ${yen(total)}</span>`;
  $('#reviewStatus').textContent = '';
  setModal('#reviewModal', true);
}

document.addEventListener('click', (event) => {
  const detail = event.target.closest('[data-detail]');
  if (detail) openProductDetail(products.find((product) => product.id === Number(detail.dataset.detail)), detail);

  const add = event.target.closest('[data-add]');
  if (add) addToCart(products.find((product) => product.id === Number(add.dataset.add)));

  const cartTrigger = event.target.closest('[data-open="cart"]');
  if (cartTrigger) openCart(cartTrigger);
  if (event.target.closest('[data-close]') || event.target.id === 'drawerBackdrop') closeCart();
  if (event.target.closest('[data-open="account"]')) showToast('ログイン機能はデモ表示です');
  if (event.target.closest('[data-detail-close]') || event.target.id === 'detailModal') setModal('#detailModal', false);
  if (event.target.closest('[data-review-close]') || event.target.id === 'reviewModal') setModal('#reviewModal', false);
  const legalTrigger = event.target.closest('[data-legal]');
  if (legalTrigger) openLegalModal(legalTrigger.dataset.legal, legalTrigger);
  if (event.target.closest('[data-legal-close]') || event.target.id === 'legalModal') closeLegalModal();

  const remove = event.target.closest('[data-remove]');
  if (remove) { cart = cart.filter((item) => item.product.id !== Number(remove.dataset.remove)); renderCart(); }
});

$('#enterSite').addEventListener('click', unlockAgeModal);
$('#leaveSite').addEventListener('click', () => { document.body.innerHTML = '<main class="exit-page"><h1>ご利用ありがとうございました。</h1><p>このページを閉じてください。</p></main>'; });
if (localStorage.getItem(AGE_VERIFIED_KEY)) {
  ageModal?.setAttribute('aria-hidden', 'true');
  if (ageModal) ageModal.style.display = 'none';
} else {
  lockAgeModalFocus();
}

$('#toggleFilter').addEventListener('click', () => {
  const open = $('#filterPanel').classList.toggle('open');
  $('#toggleFilter').setAttribute('aria-expanded', String(open));
});
['brandFilter', 'stockFilter', 'searchInput'].forEach((id) => $('#' + id).addEventListener('input', renderProducts));
$('#contactForm').addEventListener('submit', (event) => { event.preventDefault(); $('#formStatus').textContent = '送信デモ完了。実運用では安全な問い合わせ基盤に接続します。'; event.target.reset(); });
$('#checkoutButton').addEventListener('click', openReview);
$('#reviewForm').addEventListener('submit', (event) => { event.preventDefault(); $('#reviewStatus').textContent = 'デモ申請を受け付けました。実運用では本人確認・住所確認・許可条件を審査します。'; event.target.reset(); });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if ($('#reviewModal').classList.contains('open')) setModal('#reviewModal', false);
  else if ($('#detailModal').classList.contains('open')) setModal('#detailModal', false);
  else if ($('#legalModal').classList.contains('open')) closeLegalModal();
  else if ($('#cartDrawer').classList.contains('open')) closeCart();
});

restoreCart();
renderProducts();
renderCart();
