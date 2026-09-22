(() => {
  const $ = (selector) => document.querySelector(selector);
  const pageSize = 24;
  const state = {mode:'shop', group:'all', category:'all', brand:'all', device:'all', sort:'source', query:'', cart:[], visibleCount:pageSize};
  const commerce = () => globalThis.KISARAGI_COMMERCE;
  const yen = (amount) => `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const currentPrice = (item) => item.price_jpy ?? item.price ?? null;
  const priceText = (item) => currentPrice(item) == null ? '価格確認中' : yen(currentPrice(item));
  const linePriceText = (line) => currentPrice(line.item) == null ? '価格確認中' : yen(currentPrice(line.item) * line.quantity);
  const cartTotalText = () => {
    const knownTotal = state.cart.reduce((sum, line) => sum + ((currentPrice(line.item) ?? 0) * line.quantity), 0);
    return state.cart.some((line) => currentPrice(line.item) == null)
      ? `${knownTotal ? `確認済み分 ${yen(knownTotal)} + ` : ''}価格確認中`
      : yen(knownTotal);
  };
  const catalog = () => (globalThis.KISARAGI_CANONICAL_CATALOG || []).filter((item) => item.status !== 'PRICE_CONFLICT');
  const modeKey = 'kisaragi-catalog-mode-v1';
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
  const collator = new Intl.Collator('ja', {numeric:true, sensitivity:'base'});
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
  function setMode(mode, announce=false){
    if(!['shop','archive'].includes(mode))return;
    state.mode=mode;
    document.body.dataset.kisaragiMode=mode;
    sessionStorage.setItem(modeKey,mode);
    document.querySelectorAll('[data-mode-target]').forEach((button)=>{
      const active=button.dataset.modeTarget===mode;
      button.setAttribute('aria-pressed',String(active));
    });
    window.dispatchEvent(new CustomEvent('kisaragi-mode-changed',{detail:{mode}}));
    if(announce)toast(mode==='archive'?'資料モードに切り替えました':'商品モードに切り替えました');
  }
  const safeExternalUrl=(value)=>{try{const url=new URL(value,location.href);return ['http:','https:'].includes(url.protocol)?url.href:null}catch{return null}};
  let citationReturnFocus=null;
  function citationRow(label,value){
    const term=document.createElement('dt');
    const detail=document.createElement('dd');
    term.textContent=label;
    detail.textContent=String(value??'未登録');
    const row=document.createElement('div');
    row.className='citation-row';
    row.append(term,detail);
    return row;
  }
  function citationStatus(item){
    if(item.status==='IDENTITY_PENDING')return '資料転記・現行未確認';
    if(item.status==='CATALOG_ONLY')return '資料登録済み・画像未登録';
    if(item.status==='IMAGE_BOUND')return '資料登録済み・画像紐付け済み';
    return item.status||'資料登録済み';
  }
  function openCitation(item,trigger){
    const modal=$('#citationModal');
    const sourceUrl=safeExternalUrl(item.source_url||item.manufacturer_source_url);
    const sourceRegistry=Object.values(globalThis.KISARAGI_SOURCE_REGISTRY||{});
    const source=sourceRegistry.find((entry)=>entry.url&&(entry.url===item.source_url||entry.url===item.manufacturer_source_url));
    $('#citationTitle').textContent=item.product_name_ja||item.name||'商品資料';
    const body=$('#citationBody');
    body.replaceChildren(
      citationRow('品類',readableCategory(item)),
      citationRow('商品コード',item.product_code||item.sku||'未登録'),
      citationRow('資料状態',citationStatus(item)),
      citationRow('資料確認日',item.source_checked_at||'未登録'),
      citationRow('資料区分',source?.id||item.subcategory||'商品資料'),
      citationRow('画像出典',item.image_source||'画像未登録')
    );
    if(item.notes)body.append(citationRow('補足',item.notes));
    const sourceLink=$('#citationSourceLink');
    sourceLink.hidden=!sourceUrl;
    if(sourceUrl)sourceLink.href=sourceUrl;
    else sourceLink.removeAttribute('href');
    citationReturnFocus=trigger||document.activeElement;
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    $('#closeCitation').focus();
  }
  function closeCitation(){
    const modal=$('#citationModal');
    if(modal.getAttribute('aria-hidden')==='true')return;
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    citationReturnFocus?.focus();
    citationReturnFocus=null;
  }
  function handleCitationKeys(event){
    const modal=$('#citationModal');
    if(modal.getAttribute('aria-hidden')==='true')return;
    if(event.key==='Escape'){event.preventDefault();closeCitation();return}
    if(event.key!=='Tab')return;
    const items=[...modal.querySelectorAll('button,[href]')].filter((element)=>!element.hidden);
    if(!items.length)return;
    const first=items[0];
    const last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  function save(){commerce().writeCart(state.cart.map((line)=>({id:line.item.id,quantity:line.quantity})))}
  function restore(){state.cart=commerce().readCart().map((line)=>({item:catalog().find((item)=>item.id===line.id),quantity:line.quantity})).filter((line)=>line.item)}
  function matching(){
    const query=normalize(state.query);
    const items=visibleCatalog().filter((item)=>{
      const text=normalize([item.brand,item.product_name_ja,item.sku,item.product_code,item.system_code].filter(Boolean).join(' '));
      return (state.category==='all'||item.category===state.category)
        && (state.brand==='all'||item.brand===state.brand)
        && (state.device==='all'||deviceFor(item)===state.device)
        && (!query||text.includes(query));
    });
    const presentationOrder=(a,b)=>Number(!imageFor(a))-Number(!imageFor(b))
      ||Number(a.status==='IDENTITY_PENDING')-Number(b.status==='IDENTITY_PENDING');
    if (state.sort==='source') return items.sort((a,b)=>presentationOrder(a,b));
    const valueFor=state.sort==='name'
      ? (item)=>item.product_name_ja||item.name||''
      : (item)=>item.product_code||item.sku||'';
    return items.sort((a,b)=>presentationOrder(a,b)
      ||collator.compare(valueFor(a),valueFor(b))||collator.compare(a.id,b.id));
  }
  function renderFilters(){
    const host=$('#groupFilters');
    host.replaceChildren();
    const groupCounts=Object.fromEntries(Object.keys(groupLabels).map((group)=>[group,0]));
    const allItems=catalog();
    groupCounts.all=allItems.length;
    allItems.forEach((item)=>{groupCounts[groupFor(item.category)]++});
    Object.entries(groupLabels).forEach(([value,label])=>{
      const button=document.createElement('button');
      button.type='button';
      const count=document.createElement('span');
      count.className='filter-count';
      count.textContent=String(groupCounts[value]);
      button.append(document.createTextNode(label),count);
      button.setAttribute('aria-label',`${label} ${groupCounts[value]}件`);
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
      card.innerHTML=`${image?`<a class="product-image-link" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(name)}の画像を原寸で見る"><img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"></a>`:'<div class="product-empty">画像未登録</div>'}<div class="product-copy"><p class="product-meta">${escapeHtml(readableCategory(item))} / ${escapeHtml(item.brand==='UNKNOWN'?'ブランド未登録':item.brand||'ブランド未登録')}</p><h3 class="product-name">${escapeHtml(name)}</h3><p class="product-code">商品コード ${escapeHtml(item.product_code||item.sku||'未登録')}</p>${specs.length?`<p class="product-specs">${escapeHtml(specs.join(' · '))}</p>`:''}${item.status==='IDENTITY_PENDING'?'<p class="product-status">商品名は資料転記・照合待ち</p>':''}<div class="product-bottom"><div class="price">${displayAmount!=null?yen(displayAmount):'価格未登録'}<small>${escapeHtml(priceLabel)}</small></div></div><div class="product-actions"><a class="product-detail-link" href="${escapeHtml(detailUrl)}">資料庫で詳細を見る</a><button class="citation-button" type="button">出典を見る</button><button class="add-button" type="button">選択リストに追加</button></div></div>`;
      card.querySelector('.add-button').addEventListener('click',()=>add(item));
      card.querySelector('.citation-button').addEventListener('click',(event)=>openCitation(item,event.currentTarget));
      host.append(card);
    });
    if(!items.length)host.innerHTML='<p class="product-empty">該当する商品がありません。</p>';
  }
  function add(item){const existing=state.cart.find((line)=>line.item.id===item.id);if(existing){if(existing.quantity>=commerce().maxQuantity){toast('数量の上限は99点です');return}existing.quantity+=1}else{state.cart.push({item,quantity:1})}save();renderCart();toast('選択リストに追加しました')}
  function changeQuantity(itemId,delta){const line=state.cart.find((entry)=>entry.item.id===itemId);if(!line)return;line.quantity=Math.min(commerce().maxQuantity,Math.max(1,line.quantity+delta));save();renderCart()}
  function removeFromCart(itemId){state.cart=state.cart.filter((line)=>line.item.id!==itemId);save();renderCart();toast('選択リストから削除しました')}
  function renderCart(){const host=$('#cartItems');host.replaceChildren();const count=state.cart.reduce((sum,line)=>sum+line.quantity,0);$('#cartCount').textContent=count;const mobileCount=$('#mobileCartCount');if(mobileCount)mobileCount.textContent=count;$('#cartTotal').textContent=cartTotalText();if(!state.cart.length){const empty=document.createElement('p');empty.className='panel-note';empty.textContent='選択リストは空です。商品を追加してください。';host.append(empty);return}state.cart.forEach((entry)=>{const item=entry.item;const name=item.product_name_ja||item.name||'商品名未登録';const line=document.createElement('div');line.className='cart-line';line.innerHTML=`<div class="cart-line-main"><p><strong>${escapeHtml(name)}</strong></p><p>${escapeHtml(item.product_code||item.sku||'')}</p><div class="quantity-control" aria-label="${escapeHtml(name)}の数量"><button class="quantity-minus" type="button" aria-label="数量を1減らす" ${entry.quantity<=1?'disabled':''}>−</button><output aria-label="数量">${entry.quantity}</output><button class="quantity-plus" type="button" aria-label="数量を1増やす" ${entry.quantity>=commerce().maxQuantity?'disabled':''}>＋</button></div><button class="remove" type="button">削除</button></div><div class="cart-line-price"><small>${priceText(item)} × ${entry.quantity}</small><strong>${linePriceText(entry)}</strong></div>`;line.querySelector('.quantity-minus').addEventListener('click',()=>changeQuantity(item.id,-1));line.querySelector('.quantity-plus').addEventListener('click',()=>changeQuantity(item.id,1));line.querySelector('.remove').addEventListener('click',()=>removeFromCart(item.id));host.append(line)})}
  let cartReturnFocus=null;
  let releaseCartLock=null;
  function cartFocusable(){return [...$('#cartPanel').querySelectorAll('button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((element)=>!element.hidden)}
  function handleCartKeys(event){
    const panel=$('#cartPanel');
    if(panel.getAttribute('aria-hidden')==='true')return;
    if(event.key==='Escape'){event.preventDefault();closeCart();return}
    if(event.key!=='Tab')return;
    const items=cartFocusable();
    if(!items.length)return;
    const first=items[0];
    const last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  function openCart(event){
    const panel=$('#cartPanel');
    if(panel.getAttribute('aria-hidden')==='false')return;
    cartReturnFocus=event?.currentTarget||document.activeElement;
    const backdrop=$('#backdrop');
    const background=[...document.body.children].filter((element)=>![panel,backdrop].includes(element)&&element.tagName!=='SCRIPT');
    const previous=background.map((element)=>({element,inert:element.inert,aria:element.getAttribute('aria-hidden')}));
    const overflow=document.body.style.overflow;
    background.forEach((element)=>{element.inert=true;element.setAttribute('aria-hidden','true')});
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
    backdrop.hidden=false;
    document.body.style.overflow='hidden';
    releaseCartLock=()=>{
      previous.forEach(({element,inert,aria})=>{element.inert=inert;if(aria===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',aria)});
      document.body.style.overflow=overflow;
      releaseCartLock=null;
    };
    $('#closeCart').focus();
  }
  function closeCart(){
    const panel=$('#cartPanel');
    if(panel.getAttribute('aria-hidden')==='true')return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
    $('#backdrop').hidden=true;
    releaseCartLock?.();
    cartReturnFocus?.focus();
    cartReturnFocus=null;
  }
  let releaseGateLock=null;
  function lockAge(){const gate=$('#ageGate');const background=[...document.body.children].filter((element)=>element!==gate&&element.tagName!=='SCRIPT');background.forEach((element)=>{element.dataset.agePreviousAria=element.getAttribute('aria-hidden')||'';element.setAttribute('aria-hidden','true');element.setAttribute('inert','')});document.body.style.overflow='hidden';const focusable=()=>[...gate.querySelectorAll('button,[href]')].filter((element)=>!element.hidden);const trap=(event)=>{if(event.key!=='Tab')return;const items=focusable();if(!items.length)return;const first=items[0];const last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};gate.addEventListener('keydown',trap);window.setTimeout(()=>focusable()[0]?.focus(),0);releaseGateLock=()=>{gate.removeEventListener('keydown',trap);background.forEach((element)=>{const previous=element.dataset.agePreviousAria;if(previous)element.setAttribute('aria-hidden',previous);else element.removeAttribute('aria-hidden');element.removeAttribute('inert');delete element.dataset.agePreviousAria});document.body.style.overflow='';releaseGateLock=null}}
  function releaseAge(){releaseGateLock?.();sessionStorage.setItem('kisaragi-age-verified','1');$('#ageGate').hidden=true;if(location.hash==='#guide')requestAnimationFrame(()=>$('#guide').scrollIntoView({block:'start'}))}
  function init(){if(!commerce()){console.error('KISARAGI commerce configuration failed to load');return}restore();setMode(sessionStorage.getItem(modeKey)||'shop');const linkedSku=new URLSearchParams(location.search).get('sku');const linkedProduct=linkedSku&&catalog().find((item)=>item.id===linkedSku);if(linkedProduct){state.group=groupFor(linkedProduct.category);state.query=linkedProduct.product_code||linkedProduct.sku||linkedProduct.product_name_ja;$('#searchInput').value=state.query}renderFilters();renderProducts();renderCart();document.querySelectorAll('[data-mode-target]').forEach((button)=>button.addEventListener('click',()=>setMode(button.dataset.modeTarget,true)));$('#searchInput').addEventListener('input',(event)=>{state.query=event.target.value;renderProducts()});$('#categoryFilter').addEventListener('change',(event)=>{state.category=event.target.value;state.brand='all';state.device='all';renderFilters();renderProducts()});$('#brandFilter').addEventListener('change',(event)=>{state.brand=event.target.value;state.device='all';renderFilters();renderProducts()});$('#deviceFilter').addEventListener('change',(event)=>{state.device=event.target.value;renderProducts()});$('#sortOrder').addEventListener('change',(event)=>{state.sort=event.target.value;renderProducts()});$('#resetFilters').addEventListener('click',()=>{state.group='all';state.category='all';state.brand='all';state.device='all';state.sort='source';state.query='';$('#searchInput').value='';$('#sortOrder').value='source';renderFilters();renderProducts();$('#searchInput').focus()});$('#loadMoreProducts').addEventListener('click',()=>{state.visibleCount+=pageSize;renderProducts(true)});$('#openCart').addEventListener('click',openCart);const mobileCartButton=$('#mobileOpenCart');if(mobileCartButton)mobileCartButton.addEventListener('click',openCart);$('#closeCart').addEventListener('click',closeCart);$('#backdrop').addEventListener('click',closeCart);$('#startApplication').addEventListener('click',(event)=>{if(!state.cart.length){event.preventDefault();toast('商品を選択リストに追加してから確認してください')}});$('#closeCitation').addEventListener('click',closeCitation);$('#citationModal').addEventListener('click',(event)=>{if(event.target===$('#citationModal'))closeCitation()});document.addEventListener('keydown',handleCitationKeys);document.addEventListener('keydown',handleCartKeys);$('#enterSite').addEventListener('click',releaseAge);if(sessionStorage.getItem('kisaragi-age-verified')==='1')releaseAge();else lockAge()}
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
  else init();
})();
