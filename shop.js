(() => {
  const $ = (selector) => document.querySelector(selector);
  const pageSize = 24;
  const state = {group:'all', category:'all', brand:'all', device:'all', query:'', cart:[], visibleCount:pageSize};
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
  const priceText = (item) => currentPrice(item) == null ? '価格確認中' : yen(currentPrice(item));
  const cartTotalText = () => {
    const knownTotal = state.cart.reduce((sum, item) => sum + (currentPrice(item) ?? 0), 0);
    return state.cart.some((item) => currentPrice(item) == null)
      ? `${knownTotal ? `確認済み分 ${yen(knownTotal)} + ` : ''}価格確認中`
      : yen(knownTotal);
  };
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const key = 'kisaragi-shop-demo-cart-v1';
  const imageFor = (item) => {
    const asset = item.images?.[0] || item.image;
    if (!asset?.file_path) return null;
    const version = /^[a-f0-9]{64}$/i.test(asset.sha256 || '') ? asset.sha256.slice(0, 12) : null;
    return version ? `${asset.file_path}${asset.file_path.includes('?') ? '&' : '?'}v=${version}` : asset.file_path;
  };
  const categoryLabels = {CIGARETTES:'紙巻きたばこ',IMPORTED_CIGARETTES:'輸入紙巻きたばこ',CIGARS:'葉巻たばこ',RYO:'手巻きたばこ',PIPE_TOBACCO:'パイプたばこ',CUT_TOBACCO:'刻みたばこ',HEATED_TOBACCO_STICKS:'加熱式たばこスティック',HEATED_TOBACCO_CAPSULES:'加熱式たばこカプセル',HEATED_TOBACCO_DEVICES:'加熱式たばこデバイス',SMOKELESS_TOBACCO:'無煙たばこ',SMOKING_ACCESSORIES:'喫煙用品',ROLLING_ACCESSORIES:'手巻き喫煙具',PIPE_ACCESSORIES:'パイプ用品',ASHTRAYS:'携帯灰皿',LIGHTERS:'ライター'};
  const readableCategory = (item) => categoryLabels[item.category] || item.category?.replaceAll('_',' ') || '商品';
  const categoryGroups = {
    cigarettes: ['CIGARETTES', 'IMPORTED_CIGARETTES'],
    heated: ['HEATED_TOBACCO_STICKS', 'HEATED_TOBACCO_CAPSULES', 'HEATED_TOBACCO_DEVICES'],
    other: ['CIGARS', 'RYO', 'PIPE_TOBACCO', 'CUT_TOBACCO', 'SMOKELESS_TOBACCO'],
    goods: ['SMOKING_ACCESSORIES', 'ROLLING_ACCESSORIES', 'PIPE_ACCESSORIES', 'ASHTRAYS', 'LIGHTERS'],
  };
  const groupLabels = {all:'すべて', cigarettes:'紙巻き', heated:'加熱式', other:'その他たばこ', goods:'喫煙具'};
  const groupFor = (category) => Object.keys(categoryGroups).find((group) => categoryGroups[group].includes(category)) || 'other';
  const normalize = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g, '');
  const deviceFor = (item) => {
    if (!['HEATED_TOBACCO_STICKS', 'HEATED_TOBACCO_CAPSULES'].includes(item.category)) return null;
    const name = normalize(item.product_name_ja);
    if (name.includes('iqosiluma') || name.includes('イルマ用')) return 'IQOS ILUMA';
    if (name.includes('プルーム用')) return 'Ploom';
    if (name.includes('ウィズ用')) return 'with';
    if (name.includes('glohyper用') || name.includes('hyper用')) return 'glo HYPER';
    if (name.includes('glohilo用') || name.includes('hilo用')) return 'glo Hilo';
    return null;
  };
  const visibleCatalog = () => catalog().filter((item) => state.group === 'all' || groupFor(item.category) === state.group);
  const setOptions = (select, options, current) => {
    select.replaceChildren(...options.map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    select.value = options.some(([value]) => value === current) ? current : options[0][0];
    return select.value;
  };
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');window.setTimeout(()=>el.classList.remove('show'),2200)}
  function save(){localStorage.setItem(key,JSON.stringify(state.cart.map((item)=>item.id)))}
  function restore(){try{const ids=JSON.parse(localStorage.getItem(key)||'[]');state.cart=ids.map((id)=>catalog().find((item)=>item.id===id)).filter(Boolean)}catch{state.cart=[]}}
  function matching(){
    const query=normalize(state.query);
    return visibleCatalog().filter((item)=>{
      const text=normalize([item.brand,item.product_name_ja,item.sku,item.product_code,item.system_code].filter(Boolean).join(' '));
      return (state.category==='all'||item.category===state.category)
        && (state.brand==='all'||item.brand===state.brand)
        && (state.device==='all'||deviceFor(item)===state.device)
        && (!query||text.includes(query));
    });
  }
  function renderFilters(){
    const host=$('#groupFilters');
    host.replaceChildren();
    Object.entries(groupLabels).forEach(([value,label])=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      button.setAttribute('aria-pressed',String(value===state.group));
      button.addEventListener('click',()=>{state.group=value;state.category='all';state.brand='all';state.device='all';renderFilters();renderProducts()});
      host.append(button);
    });
    const groupItems=visibleCatalog();
    const categories=[...new Set(groupItems.map((item)=>item.category).filter(Boolean))];
    state.category=setOptions($('#categoryFilter'),[['all','すべての品類'],...categories.map((category)=>[category,readableCategory({category})])],state.category);
    const categoryItems=groupItems.filter((item)=>state.category==='all'||item.category===state.category);
    const brands=[...new Set(categoryItems.map((item)=>item.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    state.brand=setOptions($('#brandFilter'),[['all','すべてのブランド'],...brands.map((brand)=>[brand,brand==='UNKNOWN'?'ブランド未登録':brand])],state.brand);
    const brandItems=categoryItems.filter((item)=>state.brand==='all'||item.brand===state.brand);
    const devices=[...new Set(brandItems.map(deviceFor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    const showDevice=state.group==='heated'||categoryGroups.heated.includes(state.category);
    $('#deviceFilterWrap').hidden=!showDevice||!devices.length;
    state.device=showDevice&&devices.length
      ? setOptions($('#deviceFilter'),[['all','すべての対応機種'],...devices.map((device)=>[device,device])],state.device)
      : 'all';
  }
  function renderProducts(keepVisibleCount=false){if(keepVisibleCount!==true)state.visibleCount=pageSize;const items=matching();const shownCount=Math.min(items.length,state.visibleCount);const host=$('#productGrid');host.innerHTML='';host.classList.toggle('is-single',items.length===1);$('#resultCount').textContent=`${items.length} 件中 ${shownCount} 件を表示`;const more=$('#loadMoreProducts');more.hidden=shownCount>=items.length;more.textContent=`さらに ${Math.min(pageSize,items.length-shownCount)} 件表示`;
    items.slice(0,shownCount).forEach((item)=>{
      const card=document.createElement('article');
      card.className='product-card';
      const image=imageFor(item);
      const name=item.product_name_ja||item.name||'商品名未登録';
      const amount=currentPrice(item);
      const historical=item.historical_list_price_jpy;
      const displayAmount=amount??historical;
      const historicalLabel=item.ocr_list_price_candidate_jpy!=null?'資料価格候補':'資料掲載価格';
      const priceLabel=item.price_source==='ADMIN'?'管理者設定価格':amount!=null?'参考価格':historical!=null?`${historicalLabel}（${item.historical_price_as_of||'日付未確認'}・現行未確認）`:'価格未登録';
      const device=deviceFor(item);
      const specs=[item.pack_size!=null?`${item.pack_size}${item.pack_unit||'本'}`:null,item.tar_mg!=null?`Tar ${item.tar_mg}mg`:null,item.nicotine_mg!=null?`Nicotine ${item.nicotine_mg}mg`:null,device?`対応 ${device}`:null].filter(Boolean);
      const detailUrl=`./index.html?sku=${encodeURIComponent(item.id)}#jp-sku-catalog`;
      card.innerHTML=`${image?`<a class="product-image-link" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(name)}の画像を原寸で見る"><img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"></a>`:'<div class="product-empty">画像未登録</div>'}<div class="product-copy"><p class="product-meta">${escapeHtml(readableCategory(item))} / ${escapeHtml(item.brand==='UNKNOWN'?'ブランド未登録':item.brand||'ブランド未登録')}</p><h3 class="product-name">${escapeHtml(name)}</h3><p class="product-code">商品コード ${escapeHtml(item.product_code||item.sku||'未登録')}</p>${specs.length?`<p class="product-specs">${escapeHtml(specs.join(' · '))}</p>`:''}${item.status==='IDENTITY_PENDING'?'<p class="product-status">商品名は資料転記・照合待ち</p>':''}<div class="product-bottom"><div class="price">${displayAmount!=null?yen(displayAmount):'価格未登録'}<small>${escapeHtml(priceLabel)}</small></div></div><div class="product-actions"><a class="product-detail-link" href="${escapeHtml(detailUrl)}">資料庫で詳細を見る</a><button class="add-button" type="button">選択する</button></div></div>`;
      card.querySelector('.add-button').addEventListener('click',()=>add(item));
      host.append(card);
    });
    if(!items.length)host.innerHTML='<p class="product-empty">該当する商品がありません。</p>';
  }
  function add(item){if(!state.cart.some((entry)=>entry.id===item.id)){state.cart.push(item);save();renderCart();toast('選択リストに追加しました')}else{toast('すでに選択されています')}}
  function renderCart(){const host=$('#cartItems');host.innerHTML='';$('#cartCount').textContent=state.cart.length;$('#cartTotal').textContent=cartTotalText();if(!state.cart.length){host.innerHTML='<p class="panel-note">まだ商品は選択されていません。</p>';return}state.cart.forEach((item)=>{const line=document.createElement('div');line.className='cart-line';line.innerHTML=`<div><p><strong>${escapeHtml(item.product_name_ja||item.name)}</strong></p><p>${escapeHtml(item.product_code||item.sku||'')}</p><button class="remove" type="button">削除</button></div><strong>${priceText(item)}</strong>`;line.querySelector('.remove').addEventListener('click',()=>{state.cart=state.cart.filter((entry)=>entry.id!==item.id);save();renderCart()});host.append(line)})}
  function openCart(){const panel=$('#cartPanel');panel.classList.add('open');panel.setAttribute('aria-hidden','false');$('#backdrop').hidden=false;$('#closeCart').focus()}
  function closeCart(){const panel=$('#cartPanel');panel.classList.remove('open');panel.setAttribute('aria-hidden','true');$('#backdrop').hidden=true;$('#openCart').focus()}
  function openReview(){if(!state.cart.length){toast('商品を選択してから確認してください');return}$('#reviewSummary').innerHTML=state.cart.map((item)=>`<p><strong>${escapeHtml(item.product_name_ja||item.name)}</strong><br>${escapeHtml(item.product_code||item.sku||'')} - ${priceText(item)}</p>`).join('')+`<p><strong>参考合計 ${$('#cartTotal').textContent}</strong></p>`;$('#reviewModal').setAttribute('aria-hidden','false');closeCart();$('.close-review').focus()}
  function closeReview(){$('#reviewModal').setAttribute('aria-hidden','true');$('#openCart').focus()}
  function openApplication(){if(!state.cart.length){toast('商品を選択してから申込内容を入力してください');return}const host=$('#applicationItems');host.innerHTML=state.cart.map((item)=>`<article class="application-item"><span><strong>${escapeHtml(item.product_name_ja||item.name||'商品名確認中')}</strong><small>${escapeHtml(item.product_code||item.sku||'品番確認中')}</small></span><strong>${priceText(item)}</strong></article>`).join('')+`<div class="application-item"><strong>参考合計</strong><strong>${$('#cartTotal').textContent}</strong></div>`;$('#applicationStatus').textContent='';$('#applicationStatus').classList.remove('ok');const modal=$('#applicationModal');modal.setAttribute('aria-hidden','false');modal.querySelector('.application-card').scrollTop=0;closeCart();$('.close-application').focus()}
  function closeApplication(){$('#applicationModal').setAttribute('aria-hidden','true');$('#openCart').focus()}
  function previewApplication(event){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);const required=['nameKanji','nameKana','postalCode','prefecture','addressLine'];const status=$('#applicationStatus');if(required.some((name)=>!String(data.get(name)||'').trim())||!data.get('adultConsent')){status.classList.remove('ok');status.textContent='必須項目と20歳以上の確認を入力してください。';return}status.classList.add('ok');status.textContent=`注文プレビューを作成しました：${data.get('delivery')} / ${data.get('payment')}。この内容は保存・送信されません。決済・配送依頼は開始されません。`}
  let releaseGateLock=null;
  function lockAge(){const gate=$('#ageGate');const background=[...document.body.children].filter((element)=>element!==gate&&element.tagName!=='SCRIPT');background.forEach((element)=>{element.dataset.agePreviousAria=element.getAttribute('aria-hidden')||'';element.setAttribute('aria-hidden','true');element.setAttribute('inert','')});document.body.style.overflow='hidden';const focusable=()=>[...gate.querySelectorAll('button,[href]')].filter((element)=>!element.hidden);const trap=(event)=>{if(event.key!=='Tab')return;const items=focusable();if(!items.length)return;const first=items[0];const last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};gate.addEventListener('keydown',trap);window.setTimeout(()=>focusable()[0]?.focus(),0);releaseGateLock=()=>{gate.removeEventListener('keydown',trap);background.forEach((element)=>{const previous=element.dataset.agePreviousAria;if(previous)element.setAttribute('aria-hidden',previous);else element.removeAttribute('aria-hidden');element.removeAttribute('inert');delete element.dataset.agePreviousAria});document.body.style.overflow='';releaseGateLock=null}}
  function releaseAge(){releaseGateLock?.();sessionStorage.setItem('kisaragi-age-verified','1');$('#ageGate').hidden=true;if(location.hash==='#guide')requestAnimationFrame(()=>$('#guide').scrollIntoView({block:'start'}))}
  function init(){restore();const linkedSku=new URLSearchParams(location.search).get('sku');const linkedProduct=linkedSku&&catalog().find((item)=>item.id===linkedSku);if(linkedProduct){state.group=groupFor(linkedProduct.category);state.query=linkedProduct.product_code||linkedProduct.sku||linkedProduct.product_name_ja;$('#searchInput').value=state.query}renderFilters();renderProducts();renderCart();$('#searchInput').addEventListener('input',(event)=>{state.query=event.target.value;renderProducts()});$('#categoryFilter').addEventListener('change',(event)=>{state.category=event.target.value;state.brand='all';state.device='all';renderFilters();renderProducts()});$('#brandFilter').addEventListener('change',(event)=>{state.brand=event.target.value;state.device='all';renderFilters();renderProducts()});$('#deviceFilter').addEventListener('change',(event)=>{state.device=event.target.value;renderProducts()});$('#resetFilters').addEventListener('click',()=>{state.group='all';state.category='all';state.brand='all';state.device='all';state.query='';$('#searchInput').value='';renderFilters();renderProducts();$('#searchInput').focus()});$('#loadMoreProducts').addEventListener('click',()=>{state.visibleCount+=pageSize;renderProducts(true)});$('#openCart').addEventListener('click',openCart);$('#closeCart').addEventListener('click',closeCart);$('#backdrop').addEventListener('click',closeCart);$('#openReview').addEventListener('click',openReview);$('.close-review').addEventListener('click',closeReview);$('#closeReview').addEventListener('click',closeReview);$('#startApplication').addEventListener('click',openApplication);$('.close-application').addEventListener('click',closeApplication);$('#applicationForm').addEventListener('submit',previewApplication);$('#enterSite').addEventListener('click',releaseAge);if(sessionStorage.getItem('kisaragi-age-verified')==='1')releaseAge();else lockAge()}
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
