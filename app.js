const products = [
  {id:1,brand:'Kisaragi',brandKey:'kisaragi',name:'Kisaragi No. 01',sku:'KS-001',price:620,stock:24,category:'cigarette',flavor:'regular',origin:'日本',stock_status:'in_stock',meta:'20本 / レギュラー',tar:8,nicotine:0.6,size:'20本入',tone:'',profile:{strength:4,aroma:5,throat_hit:3,sweetness:2,menthol:0},reviews:[{id:'ks001-sora',nickname:'Sora',rating:5,smoothness:4,comment:'香りの印象が分かりやすく、ゆっくり楽しみたい時に選びました。',created:'2026.08.20',helpful:18},{id:'ks001-tk',nickname:'T.K.',rating:4,smoothness:4,comment:'しっかりした味わいですが、後味は重すぎません。',created:'2026.08.13',helpful:9}]},
  {id:2,brand:'Haru Leaf',brandKey:'haru',name:'Haru Leaf Mild',sku:'HL-014',price:580,stock:12,category:'cigarette',flavor:'regular',origin:'日本',stock_status:'in_stock',meta:'20本 / レギュラー',tar:6,nicotine:0.5,size:'20本入',tone:'red',profile:{strength:3,aroma:3,throat_hit:2,sweetness:3,menthol:0},reviews:[{id:'hl014-miki',nickname:'Miki',rating:4,smoothness:5,comment:'軽めの口当たりを探している人向けの印象です。',created:'2026.08.19',helpful:11}]},
  {id:3,brand:'Nami',brandKey:'nami',name:'Nami Classic',sku:'NM-022',price:610,stock:0,category:'cigar',flavor:'flavored',origin:'ドミニカ共和国',stock_status:'out_of_stock',meta:'5本 / アロマ',tar:10,nicotine:0.8,size:'5本入',tone:'dark',profile:{strength:5,aroma:5,throat_hit:4,sweetness:2,menthol:0},reviews:[{id:'nm022-yuu',nickname:'Yuu',rating:5,smoothness:3,comment:'香りが強めなので、時間を取れる日に向いています。',created:'2026.08.04',helpful:7}]},
  {id:4,brand:'Kisaragi',brandKey:'kisaragi',name:'Kisaragi Menthol',sku:'KS-008',price:620,stock:31,category:'cigarette',flavor:'menthol',origin:'日本',stock_status:'in_stock',meta:'20本 / メンソール',tar:7,nicotine:0.6,size:'20本入',tone:'dark',profile:{strength:3,aroma:3,throat_hit:3,sweetness:1,menthol:5},reviews:[{id:'ks008-rin',nickname:'Rin',rating:4,smoothness:4,comment:'清涼感がはっきりしていて、香りは控えめです。',created:'2026.08.21',helpful:22}]},
  {id:5,brand:'Haru Leaf',brandKey:'haru',name:'Haru Leaf Gold',sku:'HL-020',price:650,stock:7,category:'ryo',flavor:'flavored',origin:'アメリカ',stock_status:'pre_order',meta:'30g / リッチ',tar:9,nicotine:0.7,size:'30g',tone:'',profile:{strength:4,aroma:4,throat_hit:3,sweetness:4,menthol:0},reviews:[{id:'hl020-jun',nickname:'Jun',rating:4,smoothness:3,comment:'香りを楽しむタイプのデモ商品です。',created:'2026.08.17',helpful:6}]},
  {id:6,brand:'Nami',brandKey:'nami',name:'Nami Blue',sku:'NM-031',price:590,stock:0,category:'iqos',flavor:'capsule',origin:'日本',stock_status:'out_of_stock',meta:'20本 / カプセル',tar:4,nicotine:0.3,size:'20本入',tone:'red',profile:{strength:2,aroma:3,throat_hit:2,sweetness:2,menthol:4},reviews:[{id:'nm031-aoi',nickname:'Aoi',rating:3,smoothness:4,comment:'軽めの設計を想定したデモデータです。',created:'2026.08.08',helpful:3}]},
];

let cart = [];
let memberLoggedIn = false;
let lastTrigger = null;
const CART_KEY = 'kisaragiDemoCart';
const AGE_VERIFIED_KEY = 'age_verified';
const $ = (selector) => document.querySelector(selector);
const yen = (value) => `¥${value.toLocaleString('ja-JP')}（税込）`;
const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
const ageModal = $('#ageGate');
const mainContent = $('#mainContent');
let releaseAgeFocus = null;
let releaseActiveModalFocus = null;
let activeDetailProductId = null;
const helpfulVotes = new Set();
const categoryNames = {cigarette:'紙巻き',cigar:'シガー',ryo:'手巻き',iqos:'加熱式'};
const flavorNames = {regular:'レギュラー',menthol:'メンソール',capsule:'カプセル',flavored:'フレーバー'};
const stockStates = {in_stock:{label:'在庫あり',className:'in-stock'},pre_order:{label:'予約受付中',className:'pre-order'},out_of_stock:{label:'売り切れ',className:'out-of-stock'}};

let revealObserver;
function observeRevealElements() {
  document.body.classList.add('motion-ready');
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal-on-scroll').forEach((element) => element.classList.add('active'));
    return;
  }
  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('active');
      observer.unobserve(entry.target);
    });
  }, {threshold: 0.15});
  document.querySelectorAll('.reveal-on-scroll').forEach((element) => revealObserver.observe(element));
}

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
      return product?.stock_status !== 'out_of_stock' ? {product, qty: Math.min(qty, product.stock)} : null;
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
  if (!modal) return;

  if (open) {
    releaseActiveModalFocus?.();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    const background = [...document.body.children].filter((element) => element !== modal && element.tagName !== 'SCRIPT');
    background.forEach((element) => {
      element.dataset.modalAriaHidden = element.getAttribute('aria-hidden') || '';
      element.dataset.modalWasInert = String(element.hasAttribute('inert'));
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('inert', '');
    });
    const getFocusable = () => [...modal.querySelectorAll(focusable)].filter((element) => !element.hidden);
    const onKeydown = (event) => {
      if (event.key !== 'Tab') return;
      const elements = getFocusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener('keydown', onKeydown);
    window.setTimeout(() => getFocusable()[0]?.focus(), 0);
    releaseActiveModalFocus = () => {
      modal.removeEventListener('keydown', onKeydown);
      background.forEach((element) => {
        const previous = element.dataset.modalAriaHidden;
        if (previous) element.setAttribute('aria-hidden', previous);
        else element.removeAttribute('aria-hidden');
        if (element.dataset.modalWasInert !== 'true') element.removeAttribute('inert');
        delete element.dataset.modalAriaHidden;
        delete element.dataset.modalWasInert;
      });
      releaseActiveModalFocus = null;
    };
    return;
  }

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  releaseActiveModalFocus?.();
  document.body.classList.remove('modal-open');
  lastTrigger?.focus?.();
}

function lockAgeModalFocus() {
  if (!ageModal || releaseAgeFocus) return;

  document.body.classList.add('unverified');

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
    document.body.classList.remove('unverified');
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

function getCheckedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function canAdd(product) {
  return product && product.stock_status !== 'out_of_stock';
}

function updateTarRange() {
  const min = Number($('#tarMin').value);
  const max = Number($('#tarMax').value);
  if (min > max) {
    if (document.activeElement === $('#tarMin')) $('#tarMax').value = String(min);
    else $('#tarMin').value = String(max);
  }
  $('#tarRangeValue').textContent = `${$('#tarMin').value}–${$('#tarMax').value}mg`;
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
  const categories = getCheckedValues('category');
  const flavors = getCheckedValues('flavor');
  const tarMin = Number($('#tarMin').value);
  const tarMax = Number($('#tarMax').value);
  const list = products.filter((product) =>
    (brand === 'all' || product.brandKey === brand) &&
    (stock === 'all' || product.stock_status === stock) &&
    (!categories.length || categories.includes(product.category)) &&
    (!flavors.length || flavors.includes(product.flavor)) &&
    product.tar >= tarMin && product.tar <= tarMax &&
    `${product.name} ${product.sku} ${product.brand}`.toLowerCase().includes(query)
  );

  $('#resultCount').textContent = `${list.length} 件の商品`;
  $('#productGrid').innerHTML = list.length ? list.map((product) => `
    <article class="product-card reveal-on-scroll ${memberLoggedIn ? '' : 'member-locked'}">
      <button class="product-visual ${product.tone}" data-detail="${product.id}" aria-label="${product.name}の詳細を見る">
        <span class="stock-badge ${stockStates[product.stock_status].className}">${stockStates[product.stock_status].label}</span>
        <div class="pack"><small>${product.brand.toUpperCase()}</small><strong>${product.name.split(' ')[0]}<br />${product.name.split(' ')[1] || ''}</strong><small>20 / JAPAN</small></div>
      </button>
      ${memberLoggedIn ? '' : '<span class="member-lock">会員ログインで商品詳細を表示</span>'}
      <div class="product-info">
        <p class="eyebrow">${product.sku}</p><h3>${product.name}</h3>
        <div class="product-meta"><span>${categoryNames[product.category]} / ${flavorNames[product.flavor]}</span><span>${product.meta}</span></div>
        <div class="product-specs"><span>タール ${product.tar}mg</span><span>ニコチン ${product.nicotine}mg</span></div>
        <div class="product-bottom"><span class="price">${yen(product.price)}</span><button class="add-button" data-add="${product.id}" ${canAdd(product) ? '' : 'disabled'}>${product.stock_status === 'pre_order' ? '予約を申請' : canAdd(product) ? 'カートに追加' : '再入荷待ち'}</button></div>
      </div>
    </article>`).join('') : '<p class="empty-cart">条件に一致する商品がありません。</p>';
  if (document.body.classList.contains('motion-ready')) observeRevealElements();
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
  if (!canAdd(product)) return;
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

function reviewMarkup(product, order = 'latest') {
  const reviews = [...product.reviews].sort((a, b) => order === 'helpful' ? b.helpful - a.helpful : b.created.localeCompare(a.created));
  const average = (product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length).toFixed(1);
  const distribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = product.reviews.filter((review) => review.rating === rating).length;
    return `<div class="rating-row"><span>${rating} ★</span><i><b style="width:${(count / product.reviews.length) * 100}%"></b></i><strong>${count}</strong></div>`;
  }).join('');
  return `<section class="review-section" aria-labelledby="reviewHeading"><div class="review-heading"><div><p class="eyebrow">DEMO TASTE REVIEWS</p><h3 id="reviewHeading">口感レビュー</h3></div><div class="rating-total"><strong>${average}</strong><span>/ 5.0<br />${product.reviews.length}件</span></div></div><p class="review-disclaimer">掲載内容は機能検証用の架空レビューです。実運用では投稿規約・本人確認・モデレーションを設定します。</p><div class="rating-distribution">${distribution}</div><label class="review-sort">並び順<select data-review-sort><option value="latest" ${order === 'latest' ? 'selected' : ''}>最新順</option><option value="helpful" ${order === 'helpful' ? 'selected' : ''}>参考になった順</option></select></label><div class="review-list">${reviews.map((review) => `<article class="review-item"><div class="review-meta"><strong>${review.nickname}</strong><span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} · なめらかさ ${review.smoothness_rating || review.smoothness}/5</span><time>${review.created}</time></div><p>${review.comment}</p><button type="button" class="helpful-button" data-helpful="${product.id}:${review.id}" ${helpfulVotes.has(`${product.id}:${review.id}`) ? 'disabled' : ''}>このレビューは参考になりましたか？ はい <b>${review.helpful}</b></button></article>`).join('')}</div></section>`;
}

function productProfileMarkup(product) {
  const labels = {strength:'濃厚さ',aroma:'香り',throat_hit:'キック感',sweetness:'甘さ',menthol:'清涼感'};
  return `<section class="taste-profile" aria-labelledby="tasteHeading"><p class="eyebrow">FLAVOR PROFILE / DEMO</p><h3 id="tasteHeading">口感プロフィール</h3><div class="profile-bars">${Object.entries(product.profile).map(([key, value]) => `<div><span>${labels[key]}</span><i aria-label="${labels[key]} ${value}/5"><b style="width:${value * 20}%"></b></i><strong>${value}</strong></div>`).join('')}</div></section>`;
}

function renderProductDetail(product, order = 'latest') {
  $('#detailBody').innerHTML = `
    <p class="eyebrow">${product.sku} / ${product.brand}</p><h2>${product.name}</h2>
    <div class="detail-pack product-visual ${product.tone}"><div class="pack"><small>${product.brand.toUpperCase()}</small><strong>${product.name.split(' ')[0]}<br />${product.name.split(' ')[1] || ''}</strong><small>20 / JAPAN</small></div></div>
    <dl class="detail-specs"><div><dt>価格</dt><dd>${yen(product.price)}</dd></div><div><dt>カテゴリー</dt><dd>${categoryNames[product.category]}</dd></div><div><dt>風味</dt><dd>${flavorNames[product.flavor]}</dd></div><div><dt>原産地</dt><dd>${product.origin}</dd></div><div><dt>規格</dt><dd>${product.size}</dd></div><div><dt>タール / ニコチン</dt><dd>${product.tar}mg / ${product.nicotine}mg</dd></div><div><dt>在庫状態</dt><dd>${stockStates[product.stock_status].label}</dd></div></dl>
    ${productProfileMarkup(product)}
    <p class="detail-note">本商品はデモ用の架空商品です。実運用では正規商品情報・批准価格・販売許可範囲を確認して掲載します。</p>
    <button class="button button-primary full" data-add="${product.id}" ${canAdd(product) ? '' : 'disabled'}>${product.stock_status === 'pre_order' ? '予約を申請' : canAdd(product) ? 'カートに追加' : '再入荷待ち'}</button>
    ${reviewMarkup(product, order)}`;
}

function openProductDetail(product, trigger) {
  if (!memberLoggedIn) {
    lastTrigger = trigger;
    setModal('#memberModal', true);
    return;
  }
  lastTrigger = trigger;
  activeDetailProductId = product.id;
  renderProductDetail(product);
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

function openMemberCenter() {
  $('#memberBody').innerHTML = memberLoggedIn ? `<p class="eyebrow">DEMO / MEMBER AREA</p><h2 id="memberTitle">マイページ</h2><p class="member-welcome">デモ会員としてログイン中です。</p><div class="member-dashboard"><div><strong>お気に入り</strong><span>3 件</span></div><div><strong>購入・配送履歴</strong><span>2 件</span></div><div><strong>定期お届け便</strong><span>1 契約</span></div></div><div class="member-links"><button class="button button-primary" data-subscription>契約を確認</button><button class="button button-outline" data-member-action="logout">ログアウト</button></div><small>これはデモです。アカウント、注文、決済情報は保存・送信されません。</small>` : `<p class="eyebrow">DEMO / MEMBER AREA</p><h2 id="memberTitle">会員ページ</h2><p>煙草製品は、年齢確認に加えて会員認証後に閲覧・購入へ進みます。</p><div class="member-links"><button class="button button-primary" data-member-action="login">デモログイン</button><button class="button button-outline" data-member-action="register">無料会員登録</button></div><small>デモ版ではアカウント、注文、決済情報を保存・送信しません。</small>`;
  setModal('#memberModal', true);
}

function openSubscriptionModal() {
  $('#memberBody').innerHTML = `<p class="eyebrow">DEMO / SUBSCRIPTION</p><h2 id="memberTitle">定期お届け便</h2><p>お気に入りの商品を定期配送するための契約管理画面です。実運用では在庫、価格、配送間隔と解約条件を確認します。</p><div class="subscription-options"><button data-plan="monthly"><strong>毎月お届け</strong><span>配送間隔を指定</span></button><button data-plan="bi-monthly"><strong>2か月ごと</strong><span>ゆっくり選ぶ</span></button></div><div class="member-links"><button class="button button-primary" data-subscription-action>デモ契約を選択</button></div><small>デモ版では契約・決済・配送は発生しません。</small>`;
  setModal('#memberModal', true);
}

document.addEventListener('click', (event) => {
  const detail = event.target.closest('[data-detail]');
  if (detail) openProductDetail(products.find((product) => product.id === Number(detail.dataset.detail)), detail);

  const add = event.target.closest('[data-add]');
  if (add) addToCart(products.find((product) => product.id === Number(add.dataset.add)));

  const cartTrigger = event.target.closest('[data-open="cart"]');
  if (cartTrigger) openCart(cartTrigger);
  if (event.target.closest('[data-close]') || event.target.id === 'drawerBackdrop') closeCart();
  if (event.target.closest('[data-open="account"]')) { lastTrigger = event.target.closest('[data-open="account"]'); openMemberCenter(); }
  if (event.target.closest('[data-member-close]') || event.target.id === 'memberModal') setModal('#memberModal', false);
  const memberAction = event.target.closest('[data-member-action]');
  if (memberAction) {
    if (memberAction.dataset.memberAction === 'login') {
      memberLoggedIn = true;
      localStorage.setItem('kisaragiDemoMember', 'true');
      setModal('#memberModal', false);
      renderProducts();
      showToast('デモ会員としてログインしました');
    } else if (memberAction.dataset.memberAction === 'register') {
      showToast('会員登録はデモ表示です');
    } else if (memberAction.dataset.memberAction === 'logout') {
      memberLoggedIn = false;
      localStorage.removeItem('kisaragiDemoMember');
      setModal('#memberModal', false);
      renderProducts();
      showToast('デモログアウトしました');
    }
  }
  if (event.target.closest('[data-subscription]')) openSubscriptionModal();
  if (event.target.closest('[data-subscription-action]')) showToast('定期お届け便を選択しました（デモ）');
  if (event.target.closest('[data-detail-close]') || event.target.id === 'detailModal') setModal('#detailModal', false);
  if (event.target.closest('[data-review-close]') || event.target.id === 'reviewModal') setModal('#reviewModal', false);
  const legalTrigger = event.target.closest('[data-legal]');
  if (legalTrigger) openLegalModal(legalTrigger.dataset.legal, legalTrigger);
  if (event.target.closest('[data-legal-close]') || event.target.id === 'legalModal') closeLegalModal();

  const remove = event.target.closest('[data-remove]');
  if (remove) { cart = cart.filter((item) => item.product.id !== Number(remove.dataset.remove)); renderCart(); }

  const helpful = event.target.closest('[data-helpful]');
  if (helpful) {
    const [rawProductId, reviewId] = helpful.dataset.helpful.split(':');
    const productId = Number(rawProductId);
    const voteKey = `${productId}:${reviewId}`;
    if (!helpfulVotes.has(voteKey)) {
      helpfulVotes.add(voteKey);
      const reviewedProduct = products.find((product) => product.id === productId);
      const review = reviewedProduct?.reviews.find((item) => item.id === reviewId);
      if (review) review.helpful += 1;
      const product = products.find((item) => item.id === activeDetailProductId);
      if (product) renderProductDetail(product, $('#detailBody [data-review-sort]')?.value || 'latest');
      showToast('参考になったレビューとして記録しました（デモ）');
    }
  }
});

$('#enterSite').addEventListener('click', unlockAgeModal);
$('#leaveSite').addEventListener('click', () => { document.body.innerHTML = '<main class="exit-page"><h1>ご利用ありがとうございました。</h1><p>このページを閉じてください。</p></main>'; });
if (localStorage.getItem(AGE_VERIFIED_KEY)) {
  ageModal?.setAttribute('aria-hidden', 'true');
  if (ageModal) ageModal.style.display = 'none';
} else {
  lockAgeModalFocus();
}
memberLoggedIn = localStorage.getItem('kisaragiDemoMember') === 'true';

$('#toggleFilter').addEventListener('click', () => {
  const open = $('#filterPanel').classList.toggle('open');
  $('#toggleFilter').setAttribute('aria-expanded', String(open));
});
['brandFilter', 'stockFilter', 'searchInput', 'tarMin', 'tarMax'].forEach((id) => $('#' + id).addEventListener('input', () => { updateTarRange(); renderProducts(); }));
document.querySelectorAll('input[name="category"], input[name="flavor"]').forEach((input) => input.addEventListener('change', renderProducts));
document.addEventListener('change', (event) => {
  if (!event.target.matches('[data-review-sort]')) return;
  const product = products.find((item) => item.id === activeDetailProductId);
  if (product) renderProductDetail(product, event.target.value);
});
$('#contactForm').addEventListener('submit', (event) => { event.preventDefault(); $('#formStatus').textContent = '送信デモ完了。実運用では安全な問い合わせ基盤に接続します。'; event.target.reset(); });
$('#checkoutButton').addEventListener('click', openReview);
$('#reviewForm').addEventListener('submit', (event) => { event.preventDefault(); $('#reviewStatus').textContent = 'デモ申請を受け付けました。実運用では本人確認・住所確認・許可条件を審査します。'; event.target.reset(); });
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if ($('#reviewModal').classList.contains('open')) setModal('#reviewModal', false);
  else if ($('#detailModal').classList.contains('open')) setModal('#detailModal', false);
  else if ($('#legalModal').classList.contains('open')) closeLegalModal();
  else if ($('#memberModal').classList.contains('open')) setModal('#memberModal', false);
  else if ($('#cartDrawer').classList.contains('open')) closeCart();
});

restoreCart();
updateTarRange();
renderProducts();
renderCart();
observeRevealElements();
